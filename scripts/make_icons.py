#!/usr/bin/env python3
"""Gera os ícones da PWA (192, 512, maskable 512, apple 180)."""
from PIL import Image, ImageDraw, ImageFont
import os

BASE = 1024
BG_TOP = (30, 66, 49)
BG_BOTTOM = (12, 36, 26)
GOLD = (236, 207, 125)
CARD_HI = (255, 253, 248)
CARD_LO = (243, 239, 230)
HEART = (193, 58, 71)
FONT = 'C:/Windows/Fonts/segoeui.ttf'


def rounded_mask(size, radius):
    mask = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def gradient_image(size):
    img = Image.new('RGBA', (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(1, size - 1)
        r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
        g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
        b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
        d.line([(0, y), (size, y)], fill=(r, g, b, 255))
    return img


def draw_card(size, safe=0):
    """Carta única central, levemente inclinada."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    cw = int(size * 0.46)
    ch = int(size * 0.64)
    cx = size // 2
    cy = size // 2 + int(size * 0.02)

    # sombra da carta
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        [cx - cw // 2 + size * 0.02, cy - ch // 2 + size * 0.04,
         cx + cw // 2 + size * 0.02, cy + ch // 2 + size * 0.04],
        radius=int(size * 0.035), fill=(0, 0, 0, 90))
    img.alpha_composite(shadow)

    # corpo da carta (camada rotacionada)
    layer = Image.new('RGBA', (int(cw * 1.3), int(ch * 1.3)), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    pad = int(size * 0.035)
    card_w = int(cw * 1.0)
    card_h = int(ch * 1.0)
    x0 = (layer.width - card_w) // 2
    y0 = (layer.height - card_h) // 2

    # cadeia de gradiente da carta
    for y in range(card_h):
        t = y / max(1, card_h - 1)
        r = int(CARD_HI[0] + (CARD_LO[0] - CARD_HI[0]) * t)
        g = int(CARD_HI[1] + (CARD_LO[1] - CARD_HI[1]) * t)
        b = int(CARD_HI[2] + (CARD_LO[2] - CARD_HI[2]) * t)
        ld.line([(x0, y0 + y), (x0 + card_w, y0 + y)], fill=(r, g, b, 255))

    ld.rounded_rectangle([x0, y0, x0 + card_w, y0 + card_h],
                         radius=int(card_w * 0.11),
                         outline=(185, 138, 46, 255), width=max(2, int(size * 0.008)))

    # bordas de iç
    ld.rounded_rectangle([x0 + pad, y0 + pad, x0 + card_w - pad, y0 + card_h - pad],
                         radius=int(card_w * 0.07),
                         outline=(236, 207, 125, 200), width=max(1, int(size * 0.005)))

    font_corner = ImageFont.truetype(FONT, int(size * 0.065))
    ld.text((x0 + int(card_w * 0.09), y0 + int(card_h * 0.06)), 'A♥', fill=HEART, font=font_corner)

    font_heart = ImageFont.truetype(FONT, int(size * 0.24))
    bbox = ld.textbbox((0, 0), '♥', font=font_heart)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    ld.text((x0 + (card_w - tw) // 2 - bbox[0],
             y0 + (card_h - th) // 2 - bbox[1]), '♥', fill=HEART, font=font_heart)

    layer = layer.rotate(-8, resample=Image.Resampling.BICUBIC, center=(layer.width // 2, layer.height // 2))
    img.alpha_composite(layer, (int(cx - layer.width // 2), int(cy - layer.height // 2)))
    return img


def build(size, maskable=False):
    img = gradient_image(size)

    # anel dourado
    d = ImageDraw.Draw(img)
    inset = int(size * (0.10 if maskable else 0.065))
    d.rounded_rectangle([inset, inset, size - 1 - inset, size - 1 - inset],
                        radius=int(size * 0.18),
                        outline=GOLD, width=int(size * 0.014))

    img.alpha_composite(draw_card(size))

    if not maskable:
        # cantos arredondados com transparência (ícone padrão)
        mask = rounded_mask(size, int(size * 0.20))
        out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        out.paste(img, (0, 0), mask)
        return out
    return img


def apple_icon(size):
    img = gradient_image(size)
    d = ImageDraw.Draw(img)
    inset = int(size * 0.10)
    d.rounded_rectangle([inset, inset, size - 1 - inset, size - 1 - inset],
                        radius=int(size * 0.18), outline=GOLD, width=int(size * 0.022))
    img.alpha_composite(draw_card(size))
    return img.convert('RGB')


HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'icons')
os.makedirs(OUT, exist_ok=True)

for name, size, maskable in [
    ('icon-192.png', 192, False),
    ('icon-512.png', 512, False),
    ('icon-maskable-512.png', 512, True),
]:
    img = build(size, maskable=maskable)
    img.save(os.path.join(OUT, name))
    print('saved', name)

apple = apple_icon(180)
apple.save(os.path.join(OUT, 'icon-180.png'))
print('saved icon-180.png')
