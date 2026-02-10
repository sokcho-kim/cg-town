#!/usr/bin/env python3
"""
normalize-avatars.py
캐릭터 이미지 정규화 스크립트

이동방향(front/back/left/right)과 default를 분리 정규화:
- 이동 4방향: 공통 스케일 (게임 내 일관성 유지)
- default: 독립 스케일 (포즈가 다를 수 있으므로)
"""

from PIL import Image
import os
import shutil

CANVAS_W = 128
CANVAS_H = 256
TARGET_H_RATIO = 0.82
BOTTOM_MARGIN = 6

MOVE_DIRS = ['front', 'back', 'left', 'right']
ALL_DIRS = ['front', 'back', 'left', 'right', 'default']

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
AVATARS_DIR = os.path.join(SCRIPT_DIR, 'avatars')
BACKUP_DIR = os.path.join(SCRIPT_DIR, 'avatars_backup')


def get_content_bbox(img):
    alpha = img.split()[-1]
    return alpha.getbbox()


def calc_scale(bboxes, directions):
    """주어진 방향들의 바운딩박스로 공통 스케일 계산"""
    filtered = {d: bboxes[d] for d in directions if d in bboxes}
    if not filtered:
        return None
    max_w = max(b[2] - b[0] for b in filtered.values())
    max_h = max(b[3] - b[1] for b in filtered.values())
    target_h = int(CANVAS_H * TARGET_H_RATIO) - BOTTOM_MARGIN
    scale = target_h / max_h
    if max_w * scale > CANVAS_W:
        scale = CANVAS_W / max_w
    return scale


def process_image(img, bbox, scale, out_path):
    """이미지 크롭 → 스케일 → 캔버스 하단 중앙 배치"""
    cropped = img.crop(bbox)
    new_w = max(1, int(cropped.width * scale))
    new_h = max(1, int(cropped.height * scale))
    resized = cropped.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    x = (CANVAS_W - new_w) // 2
    y = CANVAS_H - BOTTOM_MARGIN - new_h
    canvas.paste(resized, (x, y), resized)
    canvas.save(out_path)
    return new_w, new_h


def normalize_character(char_dir):
    char_name = os.path.basename(char_dir)

    # 로드
    bboxes = {}
    images = {}
    for d in ALL_DIRS:
        path = os.path.join(char_dir, f'{d}.png')
        if not os.path.exists(path):
            continue
        img = Image.open(path).convert('RGBA')
        bbox = get_content_bbox(img)
        if bbox:
            bboxes[d] = bbox
            images[d] = img

    if not bboxes:
        print(f'  {char_name:15s} | SKIP')
        return

    # 이동방향 스케일
    move_scale = calc_scale(bboxes, MOVE_DIRS)
    # default 스케일 (독립)
    default_scale = calc_scale(bboxes, ['default'])

    parts = []

    # 이동 4방향 처리
    if move_scale:
        move_bbs = {d: bboxes[d] for d in MOVE_DIRS if d in bboxes}
        max_w = max(b[2]-b[0] for b in move_bbs.values())
        max_h = max(b[3]-b[1] for b in move_bbs.values())
        old_fill = (max_w * max_h) / (CANVAS_W * CANVAS_H) * 100
        for d in MOVE_DIRS:
            if d in images:
                process_image(images[d], bboxes[d], move_scale, os.path.join(char_dir, f'{d}.png'))
        nw, nh = int(max_w * move_scale), int(max_h * move_scale)
        new_fill = (nw * nh) / (CANVAS_W * CANVAS_H) * 100
        parts.append(f'move {max_w:3d}x{max_h:3d}({old_fill:2.0f}%)->x{move_scale:.2f}->{nw:3d}x{nh:3d}({new_fill:2.0f}%)')

    # default 처리
    if default_scale and 'default' in images:
        bb = bboxes['default']
        dw, dh = bb[2]-bb[0], bb[3]-bb[1]
        process_image(images['default'], bb, default_scale, os.path.join(char_dir, 'default.png'))
        ndw, ndh = int(dw * default_scale), int(dh * default_scale)
        parts.append(f'def x{default_scale:.2f}->{ndw:3d}x{ndh:3d}')

    print(f'  {char_name:15s} | {" | ".join(parts)}')


def main():
    if not os.path.exists(AVATARS_DIR):
        print(f'ERROR: {AVATARS_DIR} 없음')
        return

    if not os.path.exists(BACKUP_DIR):
        print(f'백업 생성: {BACKUP_DIR}')
        shutil.copytree(AVATARS_DIR, BACKUP_DIR)
    else:
        print(f'백업 이미 존재: {BACKUP_DIR}')

    print(f'\n정규화 시작 (타겟: 높이 {TARGET_H_RATIO*100:.0f}%, 하단여백 {BOTTOM_MARGIN}px)\n')

    chars = sorted(os.listdir(AVATARS_DIR))
    processed = 0
    for name in chars:
        char_dir = os.path.join(AVATARS_DIR, name)
        if os.path.isdir(char_dir):
            normalize_character(char_dir)
            processed += 1

    print(f'\n완료! {processed}개 캐릭터 처리됨')
    print('Supabase 재업로드: node scripts/upload-avatars.js')


if __name__ == '__main__':
    main()
