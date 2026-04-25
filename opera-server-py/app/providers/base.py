from abc import ABC, abstractmethod
from collections.abc import AsyncIterator


class LLMProvider(ABC):
    @abstractmethod
    async def call(self, system: str, user: str) -> str:
        raise NotImplementedError

    async def stream(self, system: str, user: str) -> AsyncIterator[str]:
        yield await self.call(system, user)
