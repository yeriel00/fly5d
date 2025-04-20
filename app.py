#!/usr/bin/env python3
"""
5D Hyperspace Fly‑Through Demo - Flask server with optional TPU integration
"""
import os
import json
from flask import Flask, render_template, request, jsonify
import logging

# Configure logging
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__, 
            template_folder='templates',
            static_folder='static')

# Default configuration
config = {
    'use_tpu': False,
    'render_quality': 'high',
    'max_ray_steps': 100,
    'field_of_view': 45,
    'resolution_scale': 1.0,
    'dim_step_size': 0.02
}

# Try to load config from file
try:
    if os.path.exists('config.json'):
        with open('config.json', 'r') as f:
            loaded_config = json.load(f)
            config.update(loaded_config)
            logger.info(f"Loaded configuration from file: {config}")
except Exception as e:
    logger.error(f"Error loading config: {e}")

# Optional TPU integration
tpu_available = False
try:
    if config['use_tpu']:
        from tpu_handler import TPUHandler
        tpu_handler = TPUHandler()
        tpu_available = tpu_handler.is_available()
        logger.info(f"TPU integration {'available' if tpu_available else 'not available'}")
except ImportError:
    logger.warning("TPU handler not found. Running without TPU acceleration.")

@app.route('/')
def index():
    """Serve the main application page"""
    render_params = {
        'tpu_available': tpu_available,
        'config': config
    }
    return render_template('index.html', **render_params)

@app.route('/config', methods=['GET', 'POST'])
def handle_config():
    """API endpoint to get or update configuration"""
    global config
    
    if request.method == 'POST':
        try:
            new_config = request.json
            config.update(new_config)
            
            # Save to file
            with open('config.json', 'w') as f:
                json.dump(config, f)
            
            return jsonify({'status': 'success', 'config': config})
        except Exception as e:
            return jsonify({'status': 'error', 'message': str(e)}), 400
    else:
        return jsonify({'status': 'success', 'config': config})

@app.route('/tpu-compute', methods=['POST'])
def tpu_compute():
    """Endpoint for TPU-accelerated computations"""
    if not tpu_available:
        return jsonify({'status': 'error', 'message': 'TPU not available'}), 400
    
    try:
        data = request.json
        result = tpu_handler.compute(data)
        return jsonify({'status': 'success', 'result': result})
    except Exception as e:
        logger.error(f"TPU computation error: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    # Listen on all interfaces, port 8080
    app.run(host='0.0.0.0', port=8080, debug=True)