#!/bin/sh
# Wichtel Bommi: Video einer Geschichte zusammensetzen (UNICORN-135, Herstellung siehe app/themen/wichtel/herstellung.md).
# Aufruf: stimmen/wichtel-video.sh <ordner> <ziel.mp4> [sekunden-schlussbild]
# Schlussbild normal 7,5 s (Video 35 s). Ist Bommis Video-Text länger als 31 s, das Schlussbild verlängern (z. B. 10,5 für 38 s), damit nichts abgeschnitten wird.
# Im Ordner: b1.png (Bild 1), b3.png (Bild 3, Original), c1.mp4 c2.mp4 c3.mp4 (Clips), melodie.mp3, video-ton.mp3 (Bommis Text fürs Video)
# Schluss-Standbild ist immer das Original-Bild 3, nicht das letzte Bild des Clips: Veo zieht die Figur gern ins Lächeln (Abnahme UNICORN-135).
set -e
D="$1"; Z="$2"; E="${3:-7.5}"
L=$(echo "27.5 + $E" | bc); F=$(echo "$E - 0.8" | bc); N=$(echo "$E * 30 / 1" | bc); LA=$(echo "$L - 0.8" | bc)
ffmpeg -loglevel error -y \
 -loop 1 -t 3.5 -i "$D/b1.png" -i "$D/c1.mp4" -i "$D/c2.mp4" -i "$D/c3.mp4" \
 -loop 1 -t "$E" -i "$D/b3.png" -i "$D/melodie.mp3" -i "$D/video-ton.mp3" \
 -filter_complex "\
[0]scale=1440:2560,zoompan=z='1+0.0015*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=105:s=720x1280:fps=30,trim=duration=3.5,setsar=1,fade=t=in:st=0:d=0.5[v0];\
[1]fps=30,scale=720:1280,setsar=1[v1];[2]fps=30,scale=720:1280,setsar=1[v2];[3]fps=30,scale=720:1280,setsar=1[v3];\
[4]scale=1440:2560,zoompan=z='1+0.0008*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$N:s=720x1280:fps=30,trim=duration=$E,setsar=1,fade=t=out:st=$F:d=0.8[v4];\
[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0,format=yuv420p[v];\
[5]volume=0.8,afade=t=out:st=4.2:d=0.8[m];[6]adelay=3000|3000[s];[m][s]amix=inputs=2:normalize=0:duration=longest,apad,atrim=0:$L,afade=t=out:st=$LA:d=0.8[a]" \
 -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf 27 -profile:v high -movflags +faststart -c:a aac -b:a 96k -ac 1 -t "$L" "$Z"
