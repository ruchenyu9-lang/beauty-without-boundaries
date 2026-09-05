"""User preferences ORM model."""

from sqlalchemy import Column, Integer, String, JSON, Timestamp
from sqlalchemy.orm import relationship

from app.database import Base


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(100), unique=True, nullable=False)
    skin_tone_lab = Column(JSON, comment='{"L": 65.2, "a": 12.3, "b": 18.5}')
    skin_tone_hex = Column(String(7))
    undertone = Column(String(20), comment="warm/cool/neutral")
    color_blind_type = Column(String(30), default="none", comment="protanopia/deuteranopia/tritanopia/none")
    language = Column(String(10), default="zh")

    makeup_looks = relationship("MakeupLook", back_populates="user")
    analysis_results = relationship("AnalysisResult", back_populates="user")
