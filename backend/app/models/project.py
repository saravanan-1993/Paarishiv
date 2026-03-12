from pydantic import BaseModel, Field, GetCoreSchemaHandler
from pydantic_core import core_schema
from typing import List, Optional, Any
from datetime import datetime
from bson import ObjectId


class PyObjectId(str):
    @classmethod
    def __get_pydantic_core_schema__(
        cls, _source_type: Any, _handler: GetCoreSchemaHandler
    ) -> core_schema.CoreSchema:
        return core_schema.json_or_python_schema(
            json_schema=core_schema.str_schema(),
            python_schema=core_schema.no_info_plain_validator_function(cls.validate),
        )

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return str(v)

    @classmethod
    def __get_pydantic_json_schema__(
        cls, _core_schema: core_schema.CoreSchema, handler: Any
    ) -> Any:
        return handler(core_schema.str_schema())


class ProjectModel(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    name: str
    client: str
    location: str
    budget: float
    spent: Optional[float] = 0
    start_date: datetime
    end_date: datetime
    status: str = "Ongoing"          # Ongoing | Completed | On Hold
    progress: Optional[int] = 0
    engineer_id: Optional[str] = None
    coordinator_id: Optional[str] = None
    tasks: List[Any] = []            # List of task dicts
    dprs: List[Any] = []             # List of DPR dicts
    documents: List[Any] = []        # List of document metadata dicts
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.now)

    model_config = {
        "populate_by_name": True,
        "json_encoders": {ObjectId: str},
        "arbitrary_types_allowed": True,
    }

