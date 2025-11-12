#!/bin/bash
# Example script to toggle lights
# Receives parameters as JSON string in $1

PARAMS=$1

if [ -z "$PARAMS" ]; then
    echo "Error: No parameters provided"
    exit 1
fi

# Parse the state parameter using Python (available on most systems)
STATE=$(echo "$PARAMS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('state', 'false'))")

if [ "$STATE" = "True" ] || [ "$STATE" = "true" ]; then
    # Turn lights on
    # Example: Use GPIO or call your hardware control
    # gpio -g write 17 1
    echo "Lights turned ON"
else
    # Turn lights off
    # gpio -g write 17 0
    echo "Lights turned OFF"
fi

exit 0
