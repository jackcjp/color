
docker build -t cjp/pbf2webp:v1 .

docker run -it --name pbf2webp-base -v $(pwd):/data -p 9443:80 cjp/pbf2webp:v1

