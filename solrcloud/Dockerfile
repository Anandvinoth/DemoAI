# ---------- Dockerfile ----------
FROM solr:9.6

# Switch to root to copy files
#USER root

# Copy SSL keystore and entrypoint
COPY ssl/solr-ssl.keystore.p12 /opt/solr/server/etc/solr-ssl.keystore.p12
#COPY docker-entrypoint.sh /docker-entrypoint.sh

# Make entrypoint executable
#RUN chmod 755 /docker-entrypoint.sh && chown solr:solr /docker-entrypoint.sh

# Switch back to solr user
USER solr

# Set minimal entrypoint
#ENTRYPOINT ["/docker-entrypoint.sh"]

# Expose Solr port
EXPOSE 8983
