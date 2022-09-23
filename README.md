
docker build -t cjp/pbf2webp:v1 .

docker run -it --name pbf2webp-base -v $(pwd):/data -p 9443:80 cjp/pbf2webp:v1

Steps:
1. Modify and copy config.json to current data dir, the config path should match the $(pwd);
    E.g.: $(pwd) is /mnt/144_8/gis_data/sea9, the inputPath is the mbtile in /mnt/144_8/gis_data/sea9, such as '/data/baseimage_sea2-0-1-z9_9_.sqlite',
    the metadataPath is the metadata location dir path, such as 'sea2-0-1-z9'.
    If the metadataPath dir is not same as the inputPath, more volumes are needed.
    E.g.: 'docker run -it --name pbf2webp-base3 -v /mnt/nas/data.output/zcc/4326_sea_mbtiles:/data -v /mnt/sharedata/test/sea/sea10:/sea10 -p 9445:80 cjp/pbf2webp:v1'
    The outputPath can also be defined in the config.json, volume may be also needed.
2. Run a docker container to remove over bound tiles, add color, change format with the command above; 
    NOTE: pay attention to container name and port when running more than one instance.
3. Recheck the log, mbtiles to confirm it works well.
