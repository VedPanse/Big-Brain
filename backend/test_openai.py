#!/usr/bin/env python3
"""
Test script to verify OpenAI integration
Run this after setting up your .env file with OPENAI_API_KEY
"""

import sys
import os
from dotenv import load_dotenv

# Load environment
load_dotenv(dotenv_path='../.env')

def test_openai_setup():
    """Test OpenAI API key and basic connectivity"""
    
    api_key = os.getenv('OPENAI_API_KEY')
    
    if not api_key or api_key == 'your_openai_api_key_here':
        print("❌ OPENAI_API_KEY not set in .env file")
        print("\nPlease:")
        print("1. Create/edit .env file in project root")
        print("2. Add: OPENAI_API_KEY=your_actual_api_key")
        return False
    
    print("✓ OPENAI_API_KEY found in environment")
    
    # Test import
    try:
        from openai import OpenAI
        print("✓ OpenAI library imported successfully")
    except ImportError as e:
        print(f"❌ Failed to import OpenAI: {e}")
        print("Run: pip install openai")
        return False
    
    # Test client initialization
    try:
        client = OpenAI(api_key=api_key)
        print("✓ OpenAI client initialized")
    except Exception as e:
        print(f"❌ Failed to initialize client: {e}")
        return False
    
    # Test simple API call
    try:
        print("\n🔄 Testing OpenAI API call...")
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Say 'Hello from Big Brain!'"}
            ],
            max_tokens=20
        )
        message = response.choices[0].message.content
        print(f"✓ API call successful!")
        print(f"  Response: {message}")
        return True
    except Exception as e:
        print(f"❌ API call failed: {e}")
        return False

if __name__ == "__main__":
    print("🧠 Big Brain - OpenAI Integration Test\n")
    print("=" * 50)
    
    success = test_openai_setup()
    
    print("\n" + "=" * 50)
    if success:
        print("✅ All tests passed! Your OpenAI integration is ready.")
        print("\nYou can now start the backend server:")
        print("  uvicorn main:app --reload")
        sys.exit(0)
    else:
        print("❌ Setup incomplete. Please fix the errors above.")
        sys.exit(1)
