from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

class LLMService:
    
    def __init__(self, provider="ollama"):
        self.provider = provider
        self._client = None
    
    def _get_client(self):
        if self.provider == "ollama":
            return ChatOllama(model="minimax-m2:cloud", base_url="http://localhost:11434")
        else:
            return ChatOpenAI(model="gpt-4")
    
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
