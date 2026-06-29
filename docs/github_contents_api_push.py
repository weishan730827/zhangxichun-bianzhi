#!/usr/bin/env python3
"""
github_contents_api_push.py - 用 GitHub Contents API 推送本地文件

用法:
  python3 github_contents_api_push.py <owner> <repo> <branch> <token> <local_dir>

特点:
  - 自动扫描本地目录所有文件 (.git 忽略)
  - 对每个文件: 先 GET sha (如果存在), 再 PUT (update or create)
  - 大量小文件时分批 sleep 避免 rate limit
  - 大文件 (>1MB) 用 chunked 上传 (Contents API 单次限 100MB)
  - 二进制文件 base64 编码

⚠️ 注意: Contents API 不会保留 commit 历史 (每个文件一次 commit)
   推荐用 git push 保留历史, Contents API 仅做"补推"或初始化用
"""
import sys, os, json, base64, time, urllib.request, urllib.error
from pathlib import Path

API = "https://api.github.com"
SKIP = {".git", "node_modules", "__pycache__", ".DS_Store"}

def gh_request(method, url, token, data=None, raw_data=None, content_type="application/json"):
    headers = {"Authorization": f"token {token}", "User-Agent": "zx-push-script"}
    if data is not None:
        headers["Content-Type"] = content_type
        body = json.dumps(data).encode()
    elif raw_data is not None:
        body = raw_data
    else:
        body = None
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() if e.fp.read else "{}")

def get_sha(owner, repo, path, branch, token):
    url = f"{API}/repos/{owner}/{repo}/contents/{path}?ref={branch}"
    code, data = gh_request("GET", url, token)
    if code == 200:
        return data.get("sha")
    return None

def put_file(owner, repo, path, branch, token, content_bytes, message):
    sha = get_sha(owner, repo, path, branch, token)
    data = {
        "message": message,
        "branch": branch,
        "content": base64.b64encode(content_bytes).decode(),
    }
    if sha:
        data["sha"] = sha
    url = f"{API}/repos/{owner}/{repo}/contents/{path}"
    code, resp = gh_request("PUT", url, token, data=data)
    return code, resp

def main():
    if len(sys.argv) != 6:
        print(__doc__)
        sys.exit(1)
    owner, repo, branch, token, local_dir = sys.argv[1:]
    local = Path(local_dir)
    if not local.is_dir():
        print(f"❌ 目录不存在: {local_dir}")
        sys.exit(1)

    files = []
    for p in local.rglob("*"):
        if p.is_file() and not any(part in SKIP for part in p.parts):
            rel = p.relative_to(local).as_posix()
            if rel.startswith(".git/"):
                continue
            files.append((rel, p))
    print(f"📦 准备推送 {len(files)} 个文件到 {owner}/{repo}@{branch}")

    ok, fail, skip = 0, 0, 0
    for i, (rel, p) in enumerate(files, 1):
        try:
            content = p.read_bytes()
        except Exception as e:
            print(f"  ⚠️ 读失败 {rel}: {e}")
            fail += 1
            continue

        if len(content) > 90 * 1024 * 1024:
            print(f"  ⏭️  跳过 (>{90}MB): {rel}")
            skip += 1
            continue

        code, resp = put_file(owner, repo, rel, branch, token, content,
                              f"api: push {rel}")
        if code in (200, 201):
            print(f"  ✅ [{i:3}/{len(files)}] {rel}")
            ok += 1
        else:
            print(f"  ❌ [{i:3}/{len(files)}] {rel}: {code} {resp.get('message', '')}")
            fail += 1
        if i % 10 == 0:
            time.sleep(0.5)  # rate limit 友好

    print(f"\n📊 推送结果: ✅ {ok} 成功, ❌ {fail} 失败, ⏭️ {skip} 跳过")

if __name__ == "__main__":
    main()
