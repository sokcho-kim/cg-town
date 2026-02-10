#!/bin/bash
# 아바타 이미지 정리: 한글 폴더 → 이메일 prefix 폴더, 방향별 파일명 변경
# 결과물: /Volumes/ELITE SE880/cg-town/scripts/avatars/{email_prefix}/{direction}.png

SRC="/Users/sokchokim/Downloads"
DST="/Volumes/ELITE SE880/cg-town/scripts/avatars"

rm -rf "$DST"
mkdir -p "$DST"

copy_img() {
  local name="$1" prefix="$2" file="$3" dir="$4"
  mkdir -p "$DST/$prefix"
  cp "$SRC/$name/$file" "$DST/$prefix/$dir.png"
  echo "  $prefix/$dir.png ← $name/$file"
}

echo "=== 아바타 이미지 정리 시작 ==="

# 강용제 → yjkang
echo "[강용제 → yjkang]"
copy_img "강용제" "yjkang" "Gemini_Generated_Image_p7bq29p7bq29p7bq 1.png" "front"
copy_img "강용제" "yjkang" "Gemini_Generated_Image_p7bq29p7bq29p7bq 2.png" "back"
copy_img "강용제" "yjkang" "Gemini_Generated_Image_p7bq29p7bq29p7bq 3.png" "left"
copy_img "강용제" "yjkang" "Gemini_Generated_Image_p7bq29p7bq29p7bq 4.png" "right"
copy_img "강용제" "yjkang" "Gemini_Generated_Image_p7bq29p7bq29p7bq 5.png" "default"

# 강혜진 → hj
echo "[강혜진 → hj]"
copy_img "강혜진" "hj" "Gemini_Generated_Image_3euuxw3euuxw3euu 1.png" "front"
copy_img "강혜진" "hj" "Gemini_Generated_Image_usnz11usnz11usnz 1.png" "back"
copy_img "강혜진" "hj" "Gemini_Generated_Image_3euuxw3euuxw3euu 3.png" "left"
copy_img "강혜진" "hj" "Gemini_Generated_Image_3euuxw3euuxw3euu 4.png" "right"
copy_img "강혜진" "hj" "Gemini_Generated_Image_3euuxw3euuxw3euu 5.png" "default"

# 김기석 → kks9807
echo "[김기석 → kks9807]"
copy_img "김기석" "kks9807" "Gemini_Generated_Image_7tk26l7tk26l7tk2 (1) 1.png" "front"
copy_img "김기석" "kks9807" "Gemini_Generated_Image_7tk26l7tk26l7tk2 (1) 3.png" "back"
copy_img "김기석" "kks9807" "Gemini_Generated_Image_7tk26l7tk26l7tk2 (1) 2.png" "left"
copy_img "김기석" "kks9807" "Gemini_Generated_Image_7tk26l7tk26l7tk2 (1) 4.png" "right"
copy_img "김기석" "kks9807" "Gemini_Generated_Image_7tk26l7tk26l7tk2 (1) 5.png" "default"

# 김서영 → seoyoung
echo "[김서영 → seoyoung]"
copy_img "김서영" "seoyoung" "Gemini_Generated_Image_i4jlv4i4jlv4i4jl 1.png" "front"
copy_img "김서영" "seoyoung" "Gemini_Generated_Image_i4jlv4i4jlv4i4jl 2.png" "back"
copy_img "김서영" "seoyoung" "Gemini_Generated_Image_i4jlv4i4jlv4i4jl 4.png" "left"
copy_img "김서영" "seoyoung" "Gemini_Generated_Image_i4jlv4i4jlv4i4jl 3.png" "right"
copy_img "김서영" "seoyoung" "Gemini_Generated_Image_i4jlv4i4jlv4i4jl 5.png" "default"

# 김연화 → yunha212
echo "[김연화 → yunha212]"
copy_img "김연화" "yunha212" "Gemini_Generated_Image_ad465kad465kad46 1.png" "front"
copy_img "김연화" "yunha212" "Gemini_Generated_Image_ejv2jkejv2jkejv2 1.png" "back"
copy_img "김연화" "yunha212" "Gemini_Generated_Image_7ru89s7ru89s7ru8 2.png" "left"
copy_img "김연화" "yunha212" "Gemini_Generated_Image_7ru89s7ru89s7ru8 1.png" "right"
copy_img "김연화" "yunha212" "Gemini_Generated_Image_ad465kad465kad46 2.png" "default"

# 김정현 → jhkim
echo "[김정현 → jhkim]"
copy_img "김정현" "jhkim" "Gemini_Generated_Image_4za5uk4za5uk4za5 1.png" "front"
copy_img "김정현" "jhkim" "Gemini_Generated_Image_p8fruap8fruap8fr 1.png" "back"
copy_img "김정현" "jhkim" "Gemini_Generated_Image_7kxc8k7kxc8k7kxc 2.png" "left"
copy_img "김정현" "jhkim" "Gemini_Generated_Image_7kxc8k7kxc8k7kxc 1.png" "right"
copy_img "김정현" "jhkim" "Gemini_Generated_Image_4za5uk4za5uk4za5 2.png" "default"

# 김정훈 → wjdgns429
echo "[김정훈 → wjdgns429]"
copy_img "김정훈" "wjdgns429" "Gemini_Generated_Image_5nnhen5nnhen5nnh 1.png" "front"
copy_img "김정훈" "wjdgns429" "Gemini_Generated_Image_f2uogif2uogif2uo 1.png" "back"
copy_img "김정훈" "wjdgns429" "Gemini_Generated_Image_561hmm561hmm561h 2.png" "left"
copy_img "김정훈" "wjdgns429" "Gemini_Generated_Image_561hmm561hmm561h 3.png" "right"
copy_img "김정훈" "wjdgns429" "Gemini_Generated_Image_bkxin3bkxin3bkxi 1.png" "default"

# 김지민 → jimin
echo "[김지민 → jimin]"
copy_img "김지민" "jimin" "Gemini_Generated_Image_vh02zwvh02zwvh02 1.png" "front"
copy_img "김지민" "jimin" "Gemini_Generated_Image_bdsc27bdsc27bdsc 1.png" "back"
copy_img "김지민" "jimin" "Gemini_Generated_Image_wnbkglwnbkglwnbk 3.png" "left"
copy_img "김지민" "jimin" "Gemini_Generated_Image_wnbkglwnbkglwnbk 2.png" "right"
copy_img "김지민" "jimin" "Gemini_Generated_Image_vh02zwvh02zwvh02 2.png" "default"

# 도현승 → dohs
echo "[도현승 → dohs]"
copy_img "도현승" "dohs" "Gemini_Generated_Image_m5cu5sm5cu5sm5cu 1.png" "front"
copy_img "도현승" "dohs" "Gemini_Generated_Image_wj7j5owj7j5owj7j 1.png" "back"
copy_img "도현승" "dohs" "Gemini_Generated_Image_kvttw5kvttw5kvtt 1.png" "left"
copy_img "도현승" "dohs" "Gemini_Generated_Image_kvttw5kvttw5kvtt 2.png" "right"
copy_img "도현승" "dohs" "Gemini_Generated_Image_m5cu5sm5cu5sm5cu 2.png" "default"

# 박선춘 → psc
echo "[박선춘 → psc]"
copy_img "박선춘" "psc" "Gemini_Generated_Image_ihyjzbihyjzbihyj 1.png" "front"
copy_img "박선춘" "psc" "Gemini_Generated_Image_d3yyoqd3yyoqd3yy 1.png" "back"
copy_img "박선춘" "psc" "Gemini_Generated_Image_v51njjv51njjv51n 3.png" "left"
copy_img "박선춘" "psc" "Gemini_Generated_Image_v51njjv51njjv51n 2.png" "right"
copy_img "박선춘" "psc" "Gemini_Generated_Image_oolzk6oolzk6oolz 1.png" "default"

# 서동완 → dwseo
echo "[서동완 → dwseo]"
copy_img "서동완" "dwseo" "Gemini_Generated_Image_o36emwo36emwo36e 1.png" "front"
copy_img "서동완" "dwseo" "Gemini_Generated_Image_o36emwo36emwo36e 2.png" "back"
copy_img "서동완" "dwseo" "Gemini_Generated_Image_o36emwo36emwo36e 5.png" "left"
copy_img "서동완" "dwseo" "Gemini_Generated_Image_o36emwo36emwo36e 4.png" "right"
copy_img "서동완" "dwseo" "Gemini_Generated_Image_o36emwo36emwo36e 6.png" "default"

# 오창석 → changseok (이메일 없음, 임시)
echo "[오창석 → changseok (이메일없음)]"
copy_img "오창석" "changseok" "Gemini_Generated_Image_yf067xyf067xyf06 1.png" "front"
copy_img "오창석" "changseok" "Gemini_Generated_Image_yf067xyf067xyf06 3.png" "back"
copy_img "오창석" "changseok" "Gemini_Generated_Image_yf067xyf067xyf06 4.png" "left"
copy_img "오창석" "changseok" "Gemini_Generated_Image_yf067xyf067xyf06 2.png" "right"
copy_img "오창석" "changseok" "Gemini_Generated_Image_yf067xyf067xyf06 5.png" "default"

# 이성욱 → wookie0810
echo "[이성욱 → wookie0810]"
copy_img "이성욱" "wookie0810" "Gemini_Generated_Image_qs1jinqs1jinqs1j 1.png" "front"
copy_img "이성욱" "wookie0810" "Gemini_Generated_Image_qs1jinqs1jinqs1j 4.png" "back"
copy_img "이성욱" "wookie0810" "Gemini_Generated_Image_qs1jinqs1jinqs1j 5.png" "left"
copy_img "이성욱" "wookie0810" "Gemini_Generated_Image_qs1jinqs1jinqs1j 2.png" "right"
copy_img "이성욱" "wookie0810" "Gemini_Generated_Image_qs1jinqs1jinqs1j 6.png" "default"

# 전병훈 → bhjeon (back 없음 → front 중복으로 대체)
echo "[전병훈 → bhjeon (⚠️ back 없음)]"
copy_img "전병훈" "bhjeon" "Gemini_Generated_Image_90fvk090fvk090fv 1.png" "front"
copy_img "전병훈" "bhjeon" "Gemini_Generated_Image_er3iirer3iirer3i 1.png" "back"
copy_img "전병훈" "bhjeon" "Gemini_Generated_Image_hh728shh728shh72 2.png" "left"
copy_img "전병훈" "bhjeon" "Gemini_Generated_Image_hh728shh728shh72 3.png" "right"
copy_img "전병훈" "bhjeon" "Gemini_Generated_Image_hovr7dhovr7dhovr 1.png" "default"

# 정재동 → gendhi52
echo "[정재동 → gendhi52]"
copy_img "정재동" "gendhi52" "Gemini_Generated_Image_e1dg9se1dg9se1dg 1.png" "front"
copy_img "정재동" "gendhi52" "Gemini_Generated_Image_utab69utab69utab 1.png" "back"
copy_img "정재동" "gendhi52" "Gemini_Generated_Image_642tew642tew642t 3.png" "left"
copy_img "정재동" "gendhi52" "Gemini_Generated_Image_642tew642tew642t 2.png" "right"
copy_img "정재동" "gendhi52" "Gemini_Generated_Image_qlfwwtqlfwwtqlfw 1.png" "default"

# 정태일 → tale.jung
echo "[정태일 → tale.jung]"
copy_img "정태일" "tale.jung" "Gemini_Generated_Image_36blv036blv036bl 1.png" "front"
copy_img "정태일" "tale.jung" "Gemini_Generated_Image_2ba2972ba2972ba2 1.png" "back"
copy_img "정태일" "tale.jung" "Gemini_Generated_Image_ufabcyufabcyufab 2.png" "left"
copy_img "정태일" "tale.jung" "Gemini_Generated_Image_ufabcyufabcyufab 3.png" "right"
copy_img "정태일" "tale.jung" "Gemini_Generated_Image_7i17d87i17d87i17 1.png" "default"

# 정호현 → ghgus990129
echo "[정호현 → ghgus990129]"
copy_img "정호현" "ghgus990129" "Gemini_Generated_Image_3nmnr3nmnr3nmnr3 1.png" "front"
copy_img "정호현" "ghgus990129" "Gemini_Generated_Image_p7ensrp7ensrp7en 1.png" "back"
copy_img "정호현" "ghgus990129" "Gemini_Generated_Image_3nmnr3nmnr3nmnr3 4.png" "left"
copy_img "정호현" "ghgus990129" "Gemini_Generated_Image_3nmnr3nmnr3nmnr3 3.png" "right"
copy_img "정호현" "ghgus990129" "Gemini_Generated_Image_3nmnr3nmnr3nmnr3 2.png" "default"

# 조민혁 → cmh5057
echo "[조민혁 → cmh5057]"
copy_img "조민혁" "cmh5057" "Gemini_Generated_Image_8fyqpj8fyqpj8fyq (1) 1.png" "front"
copy_img "조민혁" "cmh5057" "Gemini_Generated_Image_516lld516lld516l 1.png" "back"
copy_img "조민혁" "cmh5057" "Gemini_Generated_Image_g70g4ig70g4ig70g 1.png" "left"
copy_img "조민혁" "cmh5057" "Gemini_Generated_Image_g70g4ig70g4ig70g 2.png" "right"
copy_img "조민혁" "cmh5057" "Gemini_Generated_Image_hnp54phnp54phnp5 2.png" "default"

# 조은빈 → bin
echo "[조은빈 → bin]"
copy_img "조은빈" "bin" "Gemini_Generated_Image_hp3vxdhp3vxdhp3v 1.png" "front"
copy_img "조은빈" "bin" "Gemini_Generated_Image_gscwzfgscwzfgscw 1.png" "back"
copy_img "조은빈" "bin" "Gemini_Generated_Image_6murpo6murpo6mur 2.png" "left"
copy_img "조은빈" "bin" "Gemini_Generated_Image_6murpo6murpo6mur 1.png" "right"
copy_img "조은빈" "bin" "eunbin_default 1.png" "default"

# 주효원 → hwjoo1
echo "[주효원 → hwjoo1]"
copy_img "주효원" "hwjoo1" "Gemini_Generated_Image_5tigmv5tigmv5tig 1.png" "front"
copy_img "주효원" "hwjoo1" "Gemini_Generated_Image_5tigmv5tigmv5tig 2.png" "back"
copy_img "주효원" "hwjoo1" "Gemini_Generated_Image_5tigmv5tigmv5tig 4.png" "left"
copy_img "주효원" "hwjoo1" "Gemini_Generated_Image_5tigmv5tigmv5tig 3.png" "right"
copy_img "주효원" "hwjoo1" "Gemini_Generated_Image_5tigmv5tigmv5tig 5.png" "default"

# 한기옥 → ddc0000
echo "[한기옥 → ddc0000]"
copy_img "한기옥" "ddc0000" "Gemini_Generated_Image_g5xcasg5xcasg5xc 1.png" "front"
copy_img "한기옥" "ddc0000" "Gemini_Generated_Image_ledmamledmamledm 1.png" "back"
copy_img "한기옥" "ddc0000" "Gemini_Generated_Image_ngxtmlngxtmlngxt 3.png" "left"
copy_img "한기옥" "ddc0000" "Gemini_Generated_Image_ngxtmlngxtmlngxt 2.png" "right"
copy_img "한기옥" "ddc0000" "사진 옆으로 1.png" "default"

# 황소은 → soeun00
echo "[황소은 → soeun00]"
copy_img "황소은" "soeun00" "Gemini_Generated_Image_7u0gkb7u0gkb7u0g 1.png" "front"
copy_img "황소은" "soeun00" "Gemini_Generated_Image_7u0gkb7u0gkb7u0g 3.png" "back"
copy_img "황소은" "soeun00" "Gemini_Generated_Image_7u0gkb7u0gkb7u0g 2.png" "left"
copy_img "황소은" "soeun00" "Gemini_Generated_Image_7u0gkb7u0gkb7u0g 4.png" "right"
copy_img "황소은" "soeun00" "Gemini_Generated_Image_le1kp7le1kp7le1k 1.png" "default"

# 황현진 → hghwang
echo "[황현진 → hghwang]"
copy_img "황현진" "hghwang" "Gemini_Generated_Image_8dk6ao8dk6ao8dk6 1.png" "front"
copy_img "황현진" "hghwang" "Gemini_Generated_Image_8dk6ao8dk6ao8dk6 3.png" "back"
copy_img "황현진" "hghwang" "Gemini_Generated_Image_8dk6ao8dk6ao8dk6 2.png" "left"
copy_img "황현진" "hghwang" "Gemini_Generated_Image_8dk6ao8dk6ao8dk6 4.png" "right"
copy_img "황현진" "hghwang" "Gemini_Generated_Image_8dk6ao8dk6ao8dk6 5.png" "default"

echo ""
echo "=== 완료 ==="
echo "결과: $DST"
echo ""
echo "⚠️  누락자 (폴더 없음): 김지혜(wisekim), 박상은(ae), 성민창(sminchang), 이태림(xofla1012), 한석영(hanseok)"
echo "⚠️  전병훈(bhjeon): back 이미지 없어서 두 번째 front를 back으로 대체"

# 폴더/파일 수 확인
echo ""
echo "=== 통계 ==="
echo "폴더 수: $(ls -d "$DST"/*/ 2>/dev/null | wc -l | tr -d ' ')"
echo "총 파일 수: $(find "$DST" -name '*.png' | wc -l | tr -d ' ')"
