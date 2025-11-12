#!/usr/bin/env python3
"""
Raspberry Pi Remote Function Service
Simple REST API server that exposes configured functions for remote execution
"""

import os
import sys
import json
import subprocess
import logging
from functools import wraps
from datetime import datetime

import yaml
from flask import Flask, jsonify, request
from flask_cors import CORS
from zeroconf import ServiceInfo, Zeroconf
import socket

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for mobile app access

# Global configuration
config = None
zeroconf_service = None
zeroconf = None


def load_config(config_path='config.yaml'):
    """Load configuration from YAML file"""
    try:
        with open(config_path, 'r') as f:
            return yaml.safe_load(f)
    except Exception as e:
        logger.error(f"Failed to load config: {e}")
        sys.exit(1)


def require_api_key(f):
    """Decorator to require API key authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if not api_key or api_key != config['service']['api_key']:
            return jsonify({'error': 'Invalid or missing API key'}), 401
        return f(*args, **kwargs)
    return decorated_function


@app.route('/discover', methods=['GET'])
def discover():
    """
    Discovery endpoint - returns service information
    No authentication required for discovery
    """
    return jsonify({
        'name': config['service']['name'],
        'description': config['service'].get('description', ''),
        'version': '1.0.0',
        'timestamp': datetime.utcnow().isoformat()
    })


@app.route('/functions', methods=['GET'])
@require_api_key
def list_functions():
    """
    List all available functions with their schemas
    Requires authentication
    """
    functions = []
    for func in config['functions']:
        functions.append({
            'id': func['id'],
            'name': func['name'],
            'description': func.get('description', ''),
            'inputs': func.get('inputs', [])
        })

    return jsonify({
        'functions': functions,
        'count': len(functions)
    })


@app.route('/call/<function_id>', methods=['POST'])
@require_api_key
def call_function(function_id):
    """
    Execute a function by ID
    Expects JSON body with parameters
    """
    # Find function configuration
    func_config = None
    for func in config['functions']:
        if func['id'] == function_id:
            func_config = func
            break

    if not func_config:
        return jsonify({'error': f'Function {function_id} not found'}), 404

    # Get request parameters
    try:
        params = request.get_json() or {}
    except Exception as e:
        return jsonify({'error': 'Invalid JSON in request body'}), 400

    # Validate required inputs
    validation_error = validate_inputs(func_config, params)
    if validation_error:
        return jsonify({'error': validation_error}), 400

    # Execute the function
    try:
        result = execute_function(func_config, params)
        return jsonify({
            'status': 'success',
            'function': function_id,
            'result': result,
            'timestamp': datetime.utcnow().isoformat()
        })
    except subprocess.TimeoutExpired:
        return jsonify({
            'status': 'error',
            'error': 'Function execution timed out'
        }), 504
    except Exception as e:
        logger.error(f"Error executing {function_id}: {e}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500


def validate_inputs(func_config, params):
    """Validate function inputs against schema"""
    inputs_schema = func_config.get('inputs', [])

    for input_def in inputs_schema:
        name = input_def['name']
        required = input_def.get('required', False)
        input_type = input_def.get('type', 'string')

        # Check required fields
        if required and name not in params:
            return f"Missing required parameter: {name}"

        # Type validation
        if name in params:
            value = params[name]
            if input_type == 'boolean' and not isinstance(value, bool):
                return f"Parameter {name} must be a boolean"
            elif input_type == 'number' and not isinstance(value, (int, float)):
                return f"Parameter {name} must be a number"
            elif input_type == 'string' and not isinstance(value, str):
                return f"Parameter {name} must be a string"

    return None


def execute_function(func_config, params):
    """Execute a function script with parameters"""
    script_path = func_config['script']
    timeout = func_config.get('timeout', 30)
    return_format = func_config.get('return_format', 'text')

    # Build command
    cmd = [script_path]

    # Pass parameters as JSON string to script
    if params:
        cmd.append(json.dumps(params))

    logger.info(f"Executing: {' '.join(cmd)}")

    # Execute script
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
        shell=False
    )

    # Check exit code
    if result.returncode != 0:
        raise Exception(f"Script failed with exit code {result.returncode}: {result.stderr}")

    # Parse output
    output = result.stdout.strip()

    if return_format == 'json':
        try:
            return json.loads(output)
        except json.JSONDecodeError:
            logger.warning(f"Expected JSON but got: {output}")
            return {'raw_output': output}
    else:
        return {'output': output}


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint - no auth required"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat()
    })


def register_mdns():
    """Register service via mDNS/Zeroconf"""
    global zeroconf, zeroconf_service

    try:
        # Get local IP
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)

        port = config['service']['port']
        service_name = config['service']['name']

        # Create service info
        service_type = "_rpi-remote._tcp.local."
        service_name_full = f"{service_name}.{service_type}"

        info = ServiceInfo(
            service_type,
            service_name_full,
            addresses=[socket.inet_aton(local_ip)],
            port=port,
            properties={
                'name': service_name,
                'version': '1.0.0'
            },
            server=f"{hostname}.local."
        )

        zeroconf = Zeroconf()
        zeroconf.register_service(info)
        zeroconf_service = info

        logger.info(f"mDNS service registered: {service_name_full} on {local_ip}:{port}")
    except Exception as e:
        logger.error(f"Failed to register mDNS service: {e}")


def unregister_mdns():
    """Unregister mDNS service"""
    global zeroconf, zeroconf_service

    if zeroconf and zeroconf_service:
        try:
            zeroconf.unregister_service(zeroconf_service)
            zeroconf.close()
            logger.info("mDNS service unregistered")
        except Exception as e:
            logger.error(f"Error unregistering mDNS: {e}")


def main():
    """Main entry point"""
    global config

    # Load configuration
    config = load_config()

    # Validate config
    if not config.get('service', {}).get('api_key'):
        logger.error("API key not configured! Please set service.api_key in config.yaml")
        sys.exit(1)

    if config['service']['api_key'] == 'your-secret-key-here':
        logger.warning("WARNING: Using default API key! Please change it in config.yaml")

    # Register mDNS service
    register_mdns()

    # Start Flask server
    port = config['service']['port']
    logger.info(f"Starting server on port {port}")

    try:
        app.run(
            host='0.0.0.0',
            port=port,
            debug=False
        )
    finally:
        unregister_mdns()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        unregister_mdns()
        sys.exit(0)
