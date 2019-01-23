import sys
import argparse
import boto3
from botocore.exceptions import ClientError

parser = argparse.ArgumentParser(prog="rds-endpoint-aurora")
parser.add_argument("clustername", help="Aurora RDS cluster name")
parser.add_argument(
    "region", help="AWS region that the Aurora RDS cluster is located in")
args = parser.parse_args()

cluster_name = args.clustername
region = args.region

session = boto3.session.Session(region_name=region)
rds = session.client('rds')

try:
    cluster_response = rds.describe_db_clusters(
        DBClusterIdentifier=cluster_name,
    )

    if len(cluster_response['DBClusters']) != 1:
        print("ERROR: Could not load cluster details")
        sys.exit(1)

    print(cluster_response['DBClusters'][0]['Endpoint'])
    sys.exit(0)

except ClientError as e:
    print("Unexpected error: %s" % e)
    sys.exit(1)
