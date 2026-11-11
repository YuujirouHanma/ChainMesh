"""
Menjalankan satu node lengkap: install requirements, lalu membuka 3 jendela terminal
(Server, Client, Wallet).

Contoh:
  python __executer__.py                         node biasa (port 8333)
  python __executer__.py --peer 192.168.1.10     + peer awal (IP laptop teman)
  python __executer__.py --port 8334 --host 127.0.0.1 --data-dir nodes/node2 --peer 127.0.0.1
                                                 node ke-2 di laptop yang sama (untuk demo)
"""
import argparse
import os
import platform
import shlex
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = (("Server", "__websocketserver__.py"),
           ("Client", "__websocketclient__.py"),
           ("Wallet", "__main__.py"))
NODE_VARIABLES = ("NODE_PORT", "NODE_HOST", "NODE_BIND", "NODE_DATA_DIR", "NODE_PEERS")


def build_command(title, script):
    python = sys.executable
    path = os.path.join(ROOT, script)
    system = platform.system()
    if system == "Windows":
        # /s + tanda kutip luar: path yang mengandung spasi tetap aman; /k: jendela tidak langsung tertutup
        return f'cmd /s /k "title {title} & "{python}" "{path}""'
    exports = " ".join(f"{name}={shlex.quote(os.environ[name])}" for name in NODE_VARIABLES if os.environ.get(name))
    shell = f"cd {shlex.quote(ROOT)} && {'env ' + exports + ' ' if exports else ''}{shlex.quote(python)} {shlex.quote(path)}"
    if system == "Darwin":
        apple_script = shell.replace("\\", "\\\\").replace('"', '\\"')
        return ["osascript", "-e", f'tell application "Terminal" to do script "{apple_script}"']
    return ["gnome-terminal", f"--title={title}", "--", "bash", "-c", f"{shell}; exec bash"]


def launch(title, script, dry_run=False):
    command = build_command(title, script)
    if dry_run:
        print(command)
        return
    try:
        if platform.system() == "Windows":
            subprocess.Popen(command, cwd=ROOT, creationflags=subprocess.CREATE_NEW_CONSOLE)
        else:
            subprocess.Popen(command, cwd=ROOT)
    except FileNotFoundError:
        print(f"Cannot open a terminal automatically. Run manually: {sys.executable} {os.path.join(ROOT, script)}")


def main():
    parser = argparse.ArgumentParser(description="Start one blockchain node (server + client + wallet)")
    parser.add_argument("--port", type=int, help="WebSocket port of this node (default 8333)")
    parser.add_argument("--host", help="IP announced to other peers (default: auto-detected LAN IP)")
    parser.add_argument("--bind", help="bind address of the server (default 0.0.0.0)")
    parser.add_argument("--data-dir", help="folder for Database/ and Buffer/ (default: project folder)")
    parser.add_argument("--peer", action="append", default=[], help="initial peer IP[:PORT], may be repeated")
    parser.add_argument("--no-install", action="store_true", help="skip pip install -r requirements.txt")
    parser.add_argument("--dry-run", action="store_true", help="only print the commands, start nothing")
    args = parser.parse_args()

    for name, value in (("NODE_PORT", args.port), ("NODE_HOST", args.host), ("NODE_BIND", args.bind),
                        ("NODE_DATA_DIR", args.data_dir), ("NODE_PEERS", ",".join(args.peer))):
        if value:
            os.environ[name] = str(value)

    if not args.no_install and not args.dry_run:
        print("Installing requirements ...")
        result = subprocess.run([sys.executable, "-m", "pip", "install", "-r",
                                 os.path.join(ROOT, "requirements.txt")])
        if result.returncode != 0:
            sys.exit("pip install failed - fix the error above and try again")

    port = os.environ.get("NODE_PORT", "8333")
    for name, script in SCRIPTS:
        launch(f"{name} {port}", script, args.dry_run)


if __name__ == "__main__":
    main()
