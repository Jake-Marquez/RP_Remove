#!/usr/bin/env python3
"""
Example script to read temperature sensor
Returns JSON output
"""

import json
import random
import sys

def read_temperature():
    """
    Read temperature from sensor
    This is a mock implementation - replace with actual sensor reading

    For real sensors, you might use:
    - DHT11/DHT22: Adafruit_DHT library
    - DS18B20: w1thermsensor library
    - BME280: smbus2 library
    """

    # Mock temperature reading
    # Replace this with actual sensor code
    temperature_c = round(20 + random.uniform(-5, 10), 2)
    temperature_f = round(temperature_c * 9/5 + 32, 2)
    humidity = round(random.uniform(30, 70), 2)

    return {
        "temperature": {
            "celsius": temperature_c,
            "fahrenheit": temperature_f
        },
        "humidity": humidity,
        "unit": "celsius",
        "sensor": "mock"
    }

if __name__ == "__main__":
    try:
        result = read_temperature()
        # Print JSON to stdout - this is captured by the server
        print(json.dumps(result))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
