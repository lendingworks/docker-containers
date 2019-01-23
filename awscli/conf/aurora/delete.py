import sys
import time
import argparse
import boto3
from botocore.exceptions import ClientError


def check_cluster_exists(client, cluster_name):
    try:
        cluster_response = client.describe_db_clusters(
            DBClusterIdentifier=cluster_name,
        )
    except ClientError as e:
        if e.response['Error']['Code'] == 'DBClusterNotFoundFault':
            return False

        raise e

    return len(cluster_response['DBClusters']) > 0


def delete_cluster(cluster_name, region):
    session = boto3.session.Session(region_name=region)
    rds = session.client('rds')

    print(f"Deleting database cluster (region: {region}): {cluster_name}")
    try:
        cluster_response = rds.describe_db_clusters(
            DBClusterIdentifier=cluster_name,
        )

        if len(cluster_response['DBClusters']) != 1:
            print("  > ERROR: Could not load cluster details")
            return False

        # First delete instances if we have any.
        instance_count = len(cluster_response['DBClusters'][0]['DBClusterMembers'])
        if instance_count > 0:
            print(f"  > Deleting {instance_count} cluster instance(s) first...")

        for db_instance in cluster_response['DBClusters'][0]['DBClusterMembers']:
            rds.delete_db_instance(
                DBInstanceIdentifier=db_instance['DBInstanceIdentifier'],
                SkipFinalSnapshot=True,
            )

            # Wait for instance to be removed.
            print("    - Waiting for instance to be deleted")
            instance_waiter = rds.get_waiter('db_instance_deleted')
            instance_waiter.wait(
                DBInstanceIdentifier=db_instance['DBInstanceIdentifier'],
            )

        if instance_count > 0:
            print("  > All instance(s) deleted, now deleting cluster")

        rds.delete_db_cluster(
            DBClusterIdentifier=cluster_name,
            SkipFinalSnapshot=True
        )

        # Wait for cluster to be deleted.
        while check_cluster_exists(rds, cluster_name):
            print("    - Waiting for cluster deletion")
            time.sleep(15)

        print("  > Cluster deleted")
    except ClientError as e:
        if e.response['Error']['Code'] == 'DBClusterNotFoundFault':
            print("  > Cluster not found")
            return True
        else:
            print("  > Unexpected error: %s" % e)
            return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(prog="rds-delete-aurora")
    parser.add_argument("clustername", help="Aurora RDS cluster name")
    parser.add_argument(
        "region", help="AWS region that the Aurora RDS cluster is located in")
    args = parser.parse_args()

    cluster_name = args.clustername
    region = args.region

    success = delete_cluster(cluster_name, region)
    exit_code = 0 if success else 1
    sys.exit(exit_code)
