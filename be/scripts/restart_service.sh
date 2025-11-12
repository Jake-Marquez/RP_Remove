#!/bin/bash
# Example script to restart a system service
# Requires appropriate sudo permissions

PARAMS=$1

if [ -z "$PARAMS" ]; then
    echo "Error: No parameters provided"
    exit 1
fi

# Parse parameters
SERVICE_NAME=$(echo "$PARAMS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('service_name', ''))")
CONFIRM=$(echo "$PARAMS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('confirm', 'false'))")

if [ -z "$SERVICE_NAME" ]; then
    echo "Error: service_name is required"
    exit 1
fi

if [ "$CONFIRM" != "True" ] && [ "$CONFIRM" != "true" ]; then
    echo "Error: confirm must be true to restart service"
    exit 1
fi

# Restart the service
# NOTE: This requires the user running the script to have sudo permissions
# You may need to add to /etc/sudoers:
# pi ALL=(ALL) NOPASSWD: /bin/systemctl restart *

echo "Restarting service: $SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

if [ $? -eq 0 ]; then
    echo "Service $SERVICE_NAME restarted successfully"
    exit 0
else
    echo "Failed to restart service $SERVICE_NAME"
    exit 1
fi
