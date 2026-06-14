#!/bin/sh
set -eu

# Set the hostname from environment variable or use default
HOSTNAME="${HOSTNAME:-mail-relay.local}"
postconf -e "myhostname = ${HOSTNAME}"
postconf -e "myorigin = ${HOSTNAME}"

# Initialize aliases database to resolve the aliases.lmdb missing warning
if [ ! -f /etc/postfix/aliases ]; then
    touch /etc/postfix/aliases
fi
newaliases

postfix check
exec postfix start-fg
