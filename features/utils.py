def compute_features(packet_buffer):
    if len(packet_buffer) == 0:
        return None

    packets_per_sec = len(packet_buffer)

    unique_ports = len(set(p.get("port", 0) for p in packet_buffer))

    avg_packet_size = sum(p.get("size", 0) for p in packet_buffer) / len(packet_buffer)

    connection_count = len(packet_buffer)

    return {
        "packets_per_sec": packets_per_sec,
        "unique_ports": unique_ports,
        "avg_packet_size": avg_packet_size,
        "connection_count": connection_count
    }
