import os
from dotenv import load_dotenv

load_dotenv()

# Server configuration
PORT = int(os.getenv('PORT', 8000))

# FCS API Key (get from https://fcsapi.com/dashboard)
FCS_API_KEY = os.getenv('FCS_API_KEY', '')