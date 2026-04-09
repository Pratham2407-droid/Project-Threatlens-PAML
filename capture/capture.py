# capture.py
from scapy.all import sniff, IP, TCP, UDP, get_if_list, conf
from datetime import datetime
import json

# ─── Step 1: Find your interface ───────────────────────────────────────────────
def list_interfaces():
    print("\n[*] Available interfaces:")
    for i, iface in enumerate(get_if_list()):
        print(f"  [{i}] {iface}")
    print()

# ─── Step 2: Packet processor ──────────────────────────────────────────────────
def process_packet(packet):
    if not packet.haslayer(IP):
        return  # Skip non-IP packets

    ip_layer = packet[IP]

    if packet.haslayer(TCP):
        proto = "TCP"
        port  = packet[TCP].dport
        flags = str(packet[TCP].flags)   # SYN, ACK, FIN etc. — useful for attack detection
    elif packet.haslayer(UDP):
        proto = "UDP"
        port  = packet[UDP].dport
        flags = None
    else:
        proto = "OTHER"
        port  = None
        flags = None

    record = {
        "src_ip"  : ip_layer.src,
        "dst_ip"  : ip_layer.dst,
        "port"    : port,
        "protocol": proto,
        "flags"   : flags,               # helps detect SYN floods, port scans
        "size"    : len(packet),
        "ttl"     : ip_layer.ttl,        # abnormal TTL = spoofed packets
        "time"    : datetime.utcnow().isoformat()
    }

    # Print to console
    print(json.dumps(record))

    # Save to file for Feature Engineering Lead
    with open("packets.jsonl", "a") as f:
        f.write(json.dumps(record) + "\n")

    return record

# ─── Step 3: Choose interface & start ──────────────────────────────────────────
if __name__ == "__main__":
    list_interfaces()

    print("Which interface do you want to capture on?")
    print("  [W] Wi-Fi         → your real internet traffic ")
    print("  [V] Ethernet 2    → VirtualBox VM attack traffic ")
    print("  [S] WSL           → WSL internal traffic ")
    print("  [M] Manual        → type interface name yourself")

    choice = input("\nEnter choice: ").strip().upper()

    iface_map = {
        "W": "Wi-Fi",
        "V": "Ethernet 2",
        "S": "vEthernet (WSL (Hyper-V firewall))",
    }

    if choice in iface_map:
        iface = iface_map[choice]
    elif choice == "M":
        iface = input("Enter interface name exactly: ").strip()
    else:
        print("Invalid choice, defaulting to Wi-Fi")
        iface = "Wi-Fi"

    print(f"\n[+] Starting capture on: {iface}")
    print("[+] Saving to packets.jsonl")
    print("[+] Press Ctrl+C to stop\n")

    try:
        sniff(
            iface=iface,
            prn=process_packet,
            store=False
        )
    except KeyboardInterrupt:
        print("\n[!] Capture stopped.")
    except Exception as e:
        print(f"\n[ERROR] {e}")
        print("→ Make sure Npcap is installed and you're running as Administrator")