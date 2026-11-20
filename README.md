# Still Unnamed

How many human protein-coding genes were known only by a placeholder symbol
(C1orf112, FAM53B, KIAA0100) each year since 1986, rebuilt from the
[HGNC](https://www.genenames.org/) gene-name database and checked against HGNC's
own published counts. Look up any gene's naming history, and see the 26 genes
renamed because spreadsheets kept turning them into dates.

    ./fetch.sh && python3 build.py   # refresh data
    python3 test/test.py             # tests (and --plant for the negative controls)
