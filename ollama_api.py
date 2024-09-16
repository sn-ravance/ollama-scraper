from flask import Flask, request, jsonify
import subprocess
import socket
import time

app = Flask(__name__)

def find_available_port(start=11400, end=11499):
    """Find the first available port in the specified range."""
    for port in range(start, end + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
    raise RuntimeError(f"No available ports in the range {start}-{end}")

# Find an available port
port = find_available_port()

def is_model_installed(model_name):
    """Check if the specified model is installed in Ollama."""
    try:
        result = subprocess.run(['ollama', 'list'], capture_output=True, text=True)
        models = result.stdout.splitlines()
        return any(model_name in model for model in models)
    except Exception as e:
        print(f"Error checking if model {model_name} is installed:", str(e))
        return False

def download_model(model_name):
    """Download the specified model using Ollama."""
    try:
        print(f"Downloading model: {model_name}...")
        result = subprocess.run(['ollama', 'download', model_name], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"Model {model_name} downloaded successfully.")
            return True
        else:
            print(f"Error downloading model {model_name}: {result.stderr}")
            return False
    except Exception as e:
        print(f"Error during model download {model_name}:", str(e))
        return False

@app.route('/models', methods=['GET'])
def get_models():
    """Fetch the list of available models from Ollama."""
    try:
        output = subprocess.run(['ollama', 'list'], capture_output=True, text=True)
        models = output.stdout.splitlines()  # Split models into a list
        return jsonify({'models': models})
    except Exception as e:
        print("Error fetching models:", str(e))
        return jsonify({'error': 'Failed to fetch models', 'details': str(e)})

@app.route('/ollama', methods=['POST'])
def post_ollama():
    """Handle POST requests to interact with the selected model."""
    html_content = request.json.get('html', '')
    user_message = request.json.get('message', '')
    selected_model = request.json.get('model', 'openchat')  # Use 'openchat' as default if not specified

    # Check if HTML content is provided
    if not html_content:
        return jsonify({'response': 'No HTML content provided to extract fields from.'})

    # Check if the model is installed, and download if not
    if not is_model_installed(selected_model):
        if not download_model(selected_model):
            return jsonify({'error': f'Failed to download the model: {selected_model}'})

        # Give some time to ensure the model is fully downloaded before continuing
        time.sleep(5)

    # Prompt for structured data extraction with the selected model
    prompt = (
        f"Extract the following fields from the provided HTML content: {user_message}. "
        "Respond strictly with a valid JSON object containing the extracted fields and their values. "
        "Do not include explanations, tables, or any other text. Only return the JSON object in this format: "
        "{\"Pillows\": [\"Pillow 1\", \"Pillow 2\"], \"Prices\": [\"Price 1\", \"Price 2\"]}."
    )

    # Combine the refined prompt with the HTML content
    full_input = f"{prompt}\n{html_content}"

    # Command to run the selected model
    command = f"echo \"{full_input}\" | ollama run {selected_model}"

    try:
        output = subprocess.run(command, shell=True, capture_output=True, text=True)
        response = output.stdout if output.returncode == 0 else output.stderr
        print("Executed command:", command)
        print(f"{selected_model} response:", response)
        return jsonify({'response': response})
    except Exception as e:
        print("Error executing command:", str(e))
        return jsonify({'error': 'Failed to execute the model command', 'details': str(e)})

@app.route('/ollama', methods=['PUT', 'DELETE'])
def other_verbs():
    """Handle other HTTP verbs if needed."""
    return jsonify({'message': 'This endpoint can be extended for other HTTP verbs'})

if __name__ == '__main__':
    print(f"Starting server on port {port}")
    app.run(host='0.0.0.0', port=port)
