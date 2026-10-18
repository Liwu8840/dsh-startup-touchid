"""检查公开源码或安装包是否携带本机身份、凭据模式或不应发布的文件。"""

import argparse
import getpass
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import tarfile


def private_markers():
    """从当前环境取得待排除标识，不打印标识内容。"""
    markers = {str(Path.home()), getpass.getuser(), socket.gethostname()}
    for field in ('user.name', 'user.email'):
        result = subprocess.run(['git', 'config', '--global', '--get', field], capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            markers.add(result.stdout.strip())
    return {value for value in markers if len(value) >= 4}


def findings(name, data, markers):
    """报告规则名称，不输出命中的内容。"""
    parts = Path(name).parts
    lower = name.lower()
    bad_names = {'.ds_store', 'handoff.md', '.credentials.yaml', 'dsh-startup-touchid.json'}
    if any(part.lower() in bad_names or part.startswith('.env') for part in parts):
        yield '禁止发布的私有文件'
    if any(part in {'node_modules', '__pycache__', '.git', 'sessions', 'credentials'} for part in parts):
        yield '依赖、缓存、历史或账户目录'
    if lower.endswith(('.log', '.pyc', '.pyo', '.png', '.jpg', '.dylib')) or lower.endswith('/bin/dsh-touchid'):
        yield '日志、缓存、截图或本机二进制'
    if re.search(r'(?:^|/)lib/assets/(?:line-[1-6]|sfx-tick|sfx-ticks-run)\.mp3$', name):
        yield '未纳入公开分发的旧素材'
    for expression in (
        rb'gh[pousr]_[A-Za-z0-9]{30,}',
        rb'github_pat_[A-Za-z0-9_]{30,}',
        rb'sk-[A-Za-z0-9]{24,}',
        rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
        rb'https?://[^\s/]+:[^\s/@]+@',
    ):
        if re.search(expression, data):
            yield '凭据或私钥格式'
    # 已授权公开的 GitHub 仓库归属不属于文件内的私人身份泄漏。
    visible = re.sub(rb'https://github\.com/[A-Za-z0-9_.-]+(?:/[^\s\x00"<>)]*)?', b'PUBLIC_REPOSITORY', data)
    for marker in markers:
        for encoding in ('utf-8', 'utf-16-le', 'utf-16-be'):
            value = marker.encode(encoding)
            if encoding == 'utf-8' and '/' not in marker and '@' not in marker:
                hit = re.search(rb'(?<![A-Za-z0-9_])' + re.escape(value) + rb'(?![A-Za-z0-9_])', visible, re.IGNORECASE)
            else:
                hit = value.lower() in visible.lower()
            if hit:
                yield '当前机器或个人身份标识'
                break


def main():
    """扫描独立工作目录或 npm 打包产物。"""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--archive', type=Path)
    options = parser.parse_args()
    markers = private_markers()
    records = []
    if options.archive:
        with tarfile.open(options.archive, 'r:gz') as archive:
            for member in archive:
                if member.issym() or member.islnk() or '..' in Path(member.name).parts:
                    raise SystemExit('安装包包含链接或异常路径')
                if member.isfile():
                    records.append((member.name, archive.extractfile(member).read()))
    else:
        for file in sorted(options.root.rglob('*')):
            relative = file.relative_to(options.root)
            if '.git' in relative.parts or file.suffix == '.tgz':
                continue
            if file.is_symlink():
                raise SystemExit('发布目录包含符号链接：' + str(relative))
            if file.is_file():
                records.append((str(relative), file.read_bytes()))
    failures = [(name, issue) for name, data in records for issue in findings(name, data, markers)]
    if failures:
        for name, issue in failures:
            print(issue + '：' + name)
        raise SystemExit(1)
    print('隐私检查通过：' + str(len(records)) + ' 个文件；未发现已定义的个人标识或凭据模式。')


if __name__ == '__main__':
    main()
