def _short(text, width):
    text = str(text) if text else "-"
    return text if len(text) <= width else text[:width - 3] + "..."


def ShowPeers(peers, nodeAddress):
    print(f"\n    * Network graph of node {nodeAddress} *")
    if not peers:
        print("    No peers known yet.")
        return
    print(f"    {'Peer':<22} {'Wallet':<14} {'Out (us->peer)':<15} {'In (peer->us)':<14} "
          f"{'Latency':>10}  Last changed")
    for address, info in sorted(peers.items()):
        latency = info.get("Latency")
        latency_text = f"{latency * 1000:.1f} ms" if isinstance(latency, (int, float)) else "-"
        print(f"    {_short(address, 22):<22} {_short(info.get('PublicKey'), 14):<14} "
              f"{str(info.get('Status', 'Unknown')):<15} {'yes' if info.get('Inbound') else 'no':<14} "
              f"{latency_text:>10}  {str(info.get('LastChanged', ''))[:19]}")
    out_degree = sum(1 for info in peers.values() if info.get("Status") == "Online")
    in_degree = sum(1 for info in peers.values() if info.get("Inbound"))
    print(f"\n    Degree of this node: out = {out_degree}, in = {in_degree}  "
          f"(complete graph of {len(peers) + 1} nodes -> {len(peers)} each)")


def AskCommand():
    return input("\n    Add peer: IP or IP:PORT | remove: -IP[:PORT] | Enter: back\n    > ").strip()
