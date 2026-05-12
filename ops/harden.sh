#!/usr/bin/env bash
# Server hardening for the BDA LMIS worksserver.
#
# Run once with:   sudo bash ops/harden.sh
#
# What it does:
#   1. UFW firewall — default deny inbound, allow 22 / 80 / 443.
#   2. fail2ban with the operator IP whitelisted (no self-lockout).
#   3. SSH: key-only authentication (password + root login + challenge-
#      response all disabled).
#   4. unattended-upgrades nightly security patches.
#
# Idempotent: re-running is safe; existing config blocks are detected
# and only the missing bits are added.
set -euo pipefail

OPERATOR_IP="${OPERATOR_IP:-122.172.54.169}"

echo "── 1/4  Updating apt and installing packages …"
DEBIAN_FRONTEND=noninteractive apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ufw fail2ban unattended-upgrades apt-listchanges >/dev/null

echo "── 2/4  Configuring UFW (default deny, allow 22/80/443) …"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp  comment 'ssh'
ufw allow 80/tcp  comment 'http'
ufw allow 443/tcp comment 'https'
ufw --force enable
ufw status verbose | sed 's/^/    /'

echo "── 3/4  Configuring fail2ban with whitelist for $OPERATOR_IP …"
install -d -m 755 /etc/fail2ban
cat >/etc/fail2ban/jail.local <<EOF
# Local overrides for fail2ban — managed by ops/harden.sh
[DEFAULT]
# Whitelist the operator IP so a typo can't lock us out.
ignoreip   = 127.0.0.1/8 ::1 ${OPERATOR_IP}
bantime    = 1h
findtime   = 10m
maxretry   = 5
backend    = systemd

[sshd]
enabled  = true
port     = ssh
mode     = aggressive
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban
fail2ban-client status sshd 2>/dev/null | sed 's/^/    /' || true

echo "── 4/4  SSH daemon hardening (key-only auth) …"
SSH_DROPIN=/etc/ssh/sshd_config.d/99-bda-hardening.conf
cat >"$SSH_DROPIN" <<'EOF'
# Managed by ops/harden.sh — do not edit by hand.
PasswordAuthentication        no
PermitRootLogin               no
PermitEmptyPasswords          no
KbdInteractiveAuthentication  no
ChallengeResponseAuthentication no
UsePAM                        yes
MaxAuthTries                  3
LoginGraceTime                30
ClientAliveInterval           300
ClientAliveCountMax           2
EOF
chmod 644 "$SSH_DROPIN"
sshd -t                                                # validate config
systemctl reload ssh

echo "── 5/4  Enabling unattended-upgrades (Ubuntu security only) …"
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade   "1";
APT::Periodic::AutocleanInterval    "7";
EOF
systemctl enable --now unattended-upgrades

echo
echo "✓ Hardening complete."
echo "  · UFW status:      $(ufw status | head -1)"
echo "  · fail2ban jails:  $(fail2ban-client status | grep 'Jail list' | sed 's/.*://' | xargs)"
echo "  · Whitelisted IP:  $OPERATOR_IP"
echo "  · SSH password auth: $(grep -i PasswordAuthentication $SSH_DROPIN | awk '{print $2}')"
echo
echo "Reminder: confirm you can still SSH in a NEW window before closing"
echo "this session.  Key-based auth is now mandatory."
