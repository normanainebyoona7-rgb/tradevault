import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# API Keys
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

# Validate required environment variables
if not GEMINI_API_KEY:
    print("Warning: GEMINI_API_KEY not set. Gemini features will not work.")
