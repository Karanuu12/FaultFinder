import google.genai as genai
from google.genai import types
import sys
import os
from dotenv import load_dotenv

load_dotenv(".env.local")

API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("Error: GEMINI_API_KEY not found in .env.local")
    sys.exit(1)

client = genai.Client(api_key=API_KEY)

image_path = sys.argv[1] if len(sys.argv) > 1 else "image.png"
with open(image_path, "rb") as f:
    image_bytes = f.read()

response = client.models.generate_content(
    model="gemini-3.6-flash",
    contents=[
        types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
        "Explain this image in detail."
    ]
)
print(response.text)