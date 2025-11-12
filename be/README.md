# Raspberry Pi Remote Function Service

A simple REST API service that runs on Raspberry Pi and allows remote execution of configured functions via a mobile app.

## Features

- **REST API** - Simple HTTP endpoints for function discovery and execution
- **mDNS Discovery** - Automatic service discovery on local network
- **Configurable Functions** - Easy YAML configuration for custom functions
- **API Key Authentication** - Basic security for remote access
- **Input Validation** - Type checking and required field validation
- **Timeout Protection** - Configurable timeouts prevent hanging operations

## Quick Start

### Installation

1. Clone or copy this directory to your Raspberry Pi

2. Install dependencies:
```bash
pip3 install -r requirements.txt
```

3. Make scripts executable:
```bash
chmod +x scripts/*.sh scripts/*.py
```

4. Configure your service:
   - Edit `config.yaml`
   - Change the `api_key` to a secure value
   - Update service name and description
   - Add/modify functions as needed

5. Run the server:
```bash
python3 server.py
```

### Running as a Service (Optional)

To run the service automatically on boot:

1. Create a systemd service file:
```bash
sudo nano /etc/systemd/system/rpi-remote.service
```

2. Add the following content (adjust paths as needed):
```ini
[Unit]
Description=Raspberry Pi Remote Function Service
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/rp_manager/be
ExecStart=/usr/bin/python3 /home/pi/rp_manager/be/server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

3. Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable rpi-remote.service
sudo systemctl start rpi-remote.service
```

4. Check status:
```bash
sudo systemctl status rpi-remote.service
```

## Configuration

### config.yaml Structure

```yaml
service:
  name: "Your Device Name"
  description: "Description of this Pi"
  port: 5000
  api_key: "your-secret-key"

functions:
  - id: "function_id"
    name: "Display Name"
    description: "What this function does"
    inputs:
      - name: "param_name"
        type: "boolean|string|number"
        description: "Parameter description"
        required: true|false
    script: "./scripts/your_script.sh"
    timeout: 30
    return_format: "text|json"
```

### Input Types

- `boolean` - true/false values
- `string` - Text values
- `number` - Integer or float values

### Creating Custom Functions

1. Write a script (bash, python, etc.) in the `scripts/` directory
2. Make it executable: `chmod +x scripts/your_script.sh`
3. Script receives parameters as JSON string in first argument (`$1`)
4. Script should print output to stdout
5. Exit with code 0 for success, non-zero for errors

Example bash script:
```bash
#!/bin/bash
PARAMS=$1
VALUE=$(echo "$PARAMS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('param_name'))")
echo "Processing: $VALUE"
exit 0
```

Example python script:
```python
#!/usr/bin/env python3
import sys
import json

params = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
result = {"status": "success", "data": params}
print(json.dumps(result))
sys.exit(0)
```

## API Endpoints

### Discovery (No Auth)

**GET /discover**
```json
{
  "name": "Workshop Pi",
  "description": "IoT development device",
  "version": "1.0.0",
  "timestamp": "2025-11-05T10:30:00"
}
```

**GET /health**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-05T10:30:00"
}
```

### Authenticated Endpoints

All endpoints below require header:
```
X-API-Key: your-secret-key
```

**GET /functions**

List all available functions:
```json
{
  "functions": [
    {
      "id": "toggle_lights",
      "name": "Toggle Workshop Lights",
      "description": "Turn the workshop lights on or off",
      "inputs": [
        {
          "name": "state",
          "type": "boolean",
          "description": "true for on, false for off",
          "required": true
        }
      ]
    }
  ],
  "count": 1
}
```

**POST /call/{function_id}**

Execute a function:
```bash
curl -X POST http://raspberrypi.local:5000/call/toggle_lights \
  -H "X-API-Key: your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"state": true}'
```

Response:
```json
{
  "status": "success",
  "function": "toggle_lights",
  "result": {
    "output": "Lights turned ON"
  },
  "timestamp": "2025-11-05T10:30:00"
}
```

## mDNS Discovery

The service automatically advertises itself on the local network as:
- Service Type: `_rpi-remote._tcp.local.`
- Service Name: Your configured service name

Mobile apps can discover the service without knowing the IP address.

## Security Considerations

⚠️ **Important Security Notes:**

1. **Change the default API key** in `config.yaml`
2. **Use only on trusted local networks** - not exposed to internet
3. **Be careful with script permissions** - scripts run with service user privileges
4. **Validate script inputs** - avoid command injection
5. **Consider HTTPS** for sensitive operations (requires additional setup)

### sudo Permissions (Optional)

If your scripts need sudo access (e.g., restart services), add to `/etc/sudoers`:
```
pi ALL=(ALL) NOPASSWD: /bin/systemctl restart *
```

Use `sudo visudo` to edit safely.

## Troubleshooting

### Service won't start
- Check logs: `journalctl -u rpi-remote.service -f`
- Verify Python dependencies are installed
- Check that port 5000 is not in use

### mDNS discovery not working
- Ensure Avahi/Bonjour is installed: `sudo apt-get install avahi-daemon`
- Check firewall settings
- Verify devices are on same network

### Script execution fails
- Check script permissions: `ls -la scripts/`
- Test script manually: `./scripts/your_script.sh '{"param":"value"}'`
- Check timeout values in config

### Authentication errors
- Verify API key matches in config.yaml
- Check request includes `X-API-Key` header

## Example Testing

Test with curl:

```bash
# Discovery (no auth)
curl http://raspberrypi.local:5000/discover

# List functions
curl -H "X-API-Key: your-secret-key" http://raspberrypi.local:5000/functions

# Call function
curl -X POST http://raspberrypi.local:5000/call/check_temperature \
  -H "X-API-Key: your-secret-key" \
  -H "Content-Type: application/json"

# Call with parameters
curl -X POST http://raspberrypi.local:5000/call/toggle_lights \
  -H "X-API-Key: your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"state": true}'
```

## License

MIT - Use freely for your projects!
