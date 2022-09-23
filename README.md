
docker build -t cjp/pbf2webp:v1 .

docker run -it --name pbf2webp-base -v $(pwd):/data -p 9443:80 cjp/pbf2webp:v1

Steps:
0. Prepare the docker environment and cjp/pbf2webp image;
1. Modify and copy config.json to current data dir, the config path should match the $(pwd);
    E.g.: $(pwd) is /mnt/144_8/gis_data/sea9, the inputPath is the mbtile in /mnt/144_8/gis_data/sea9, such as '/data/baseimage_sea2-0-1-z9_9_.sqlite',
    the metadataPath is the metadata location dir path, such as 'sea2-0-1-z9'.
    If the metadataPath dir is not same as the inputPath, more volumes are needed.
    E.g.: 'docker run -it --name pbf2webp-base3 -v /mnt/nas/data.output/zcc/4326_sea_mbtiles:/data -v /mnt/sharedata/test/sea/sea10:/sea10 -p 9445:80 cjp/pbf2webp:v1'
    The outputPath can also be defined in the config.json, volume may be also needed.
2. Run a docker container to remove over bound tiles, add color, change format with the command above; 
    NOTE: pay attention to container name and port when running more than one instance.
3. Recheck the log, mbtiles to confirm it works well.

0. 准备好docker环境和cjp/pbf2webp image；
1. 修改config.json，添加inputPath， metadataPath， outputPath（可选的）
    config.json的路径要和映射的volume 的路径对应
    例如：volume 的路径是/mnt/144_8/gis_data/sea9:/data， inputPath就是sea9目录下的一个mbtiles， inputPath:"/data/baseimage_sea2-0-1-z9_9_.sqlite";
    metadataPath，outputPath也是同样的。
    如果inputPath，metadataPath，outputPath不是在同一个文件夹下，那么都需要volume进到container中。
    配置完成后把config.json拷贝到 /data 对应的volume的路径下，在这个例子中就是/mnt/144_8/gis_data/sea9下。
2. 通过命令行 (E.g.:'docker run -it --name pbf2webp-base3 -v /mnt/nas/data.output/zcc/4326_sea_mbtiles:/data -v /mnt/sharedata/test/sea/sea10:/sea10 -p 9445:80 cjp/pbf2webp:v1')
    启动一个container就可以开始跑了。
    如果想同时开跑多个container实例，记得区分name和port就行。
3. 跑完后检查日志和生成的mbtiles，看是否正确。
