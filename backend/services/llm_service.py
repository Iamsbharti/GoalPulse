import os
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

class LLMService:
    
    def __init__(self):
        # Determine provider based on APP_ENV
        # 'production' -> openai
        # anything else -> ollama (local)
        app_env = os.getenv("APP_ENV", "local")
       
        
        if app_env == "production":
            self.provider = "openai"
        else:
            self.provider = "ollama"
            
        self._client = None
    
    def _get_client(self):
        if self.provider == "ollama":
            local_model='minimax-m2:cloud'
            # local_model='gpt-oss:20b'
            return ChatOllama(model=local_model, base_url="http://localhost:11434")
        elif self.provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            return ChatOpenAI(model="gpt-5.2", api_key=api_key)
        else:
            return None
    
    async def generate(self, prompt: str) -> str:
        client = self._get_client()
        if client is None:
            return f"[{self.provider.upper()} unavailable] {prompt}"
        
        try:
            response = await client.ainvoke(prompt)
            return response.content
        except Exception as e:
            return f"Error: {str(e)}"

llm_service = LLMService()
