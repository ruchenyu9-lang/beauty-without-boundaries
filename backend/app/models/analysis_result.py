"""Image analysis result ORM model."""

from sqlalchemy import Column, Integer, String, JSON, Text, Timestamp
from sqlalchemy.orm import relationship

from app.database import Base


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(100), nullable=False, index=True)
    image_url = Column(String(500))
    detected_style = Column(String(100))
    detected_products = Column(JSON, nullable=False)
    step_instructions = Column(JSON, nullable=False)
    substitute_products = Column(JSON, nullable=False)

    user = relationship("UserPreference", back_populates="analysis_results")
