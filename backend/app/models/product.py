"""Product catalog ORM model."""

from sqlalchemy import Boolean, Column, Decimal, Integer, String, Text, Timestamp
from sqlalchemy.orm import relationship

from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    brand = Column(String(100), nullable=False, comment="e.g. L'Oreal Paris")
    product_name = Column(String(200), nullable=False, comment="e.g. True Match Foundation")
    product_type = Column(String(50), nullable=False, comment="foundation/lipstick/blush/eyeshadow/concealer/mascara")
    category = Column(String(50), comment="face/eye/lip/cheek")
    price = Column(Decimal(10, 2), comment="retail price for substitute matching")
    description = Column(Text)
    image_url = Column(String(500))
    is_loreal = Column(Boolean, default=True, comment="whether L'Oreal brand product")

    shades = relationship("Shade", back_populates="product", cascade="all, delete-orphan")


class Shade(Base):
    __tablename__ = "shades"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, nullable=False, index=True)
    shade_name = Column(String(100), nullable=False, comment="e.g. N4 Soft Sable, 220 Rose")
    shade_number = Column(String(50), nullable=False, comment="e.g. N4, 220")
    hex_color = Column(String(7), nullable=False, comment="e.g. #D4A574")
    lab_l = Column(float, nullable=False, comment="Lab L* (0-100)")
    lab_a = Column(float, nullable=False, comment="Lab a*")
    lab_b = Column(float, nullable=False, comment="Lab b*")
    rgb_r = Column(Integer, nullable=False)
    rgb_g = Column(Integer, nullable=False)
    rgb_b = Column(Integer, nullable=False)
    undertone = Column(String(20), comment="warm/cool/neutral")
    finish_type = Column(String(30), comment="matte/satin/glossy/dewy")
    coverage = Column(String(30), comment="full/medium/light/shear")

    product = relationship("Product", back_populates="shades")
