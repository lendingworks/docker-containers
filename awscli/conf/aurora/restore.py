import sys
import argparse
import boto3
from botocore.exceptions import ClientError
import delete as auroradelete


parser = argparse.ArgumentParser(prog="rds-restore-aurora")
parser.add_argument("source-cluster", help="Aurora RDS cluster to restore from")
parser.add_argument("new-cluster-name", help="Name for the new Aurora RDS cluster")
parser.add_argument("region", help="AWS region that the source (and the target) Aurora RDS cluster is located in")
parser.add_argument("security-group", help="Security group to use for the new cluster")
parser.add_argument("subnet-group", help="DB subnet group to use for the new cluster")
parser.add_argument("parameter-group", help="Cluster parameter group to use for the new cluster")
parser.add_argument("restore-time", help="Point-in-time that the new cluster should be created from")
parser.add_argument("--instance-class", default="db.r4.large", help="Instance class to use for the new cluster")
args = vars(parser.parse_args())

session = boto3.session.Session(region_name=args["region"])
rds = session.client('rds')

try:
    new_cluster_name = args["new-cluster-name"]

    # First delete the existing cluster if it exists.
    print("Deleting existing cluster if it exists...")
    auroradelete.delete_cluster(new_cluster_name, args["region"])

    print(f"\nCreating new cluster ({new_cluster_name})...")
    rds.restore_db_cluster_to_point_in_time(
        DBClusterIdentifier=new_cluster_name,
        RestoreType="full-copy",
        SourceDBClusterIdentifier=args["source-cluster"],
        RestoreToTime=args["restore-time"],
        DBSubnetGroupName=args["subnet-group"],
        VpcSecurityGroupIds=[args["security-group"]],
        DBClusterParameterGroupName=args["parameter-group"],
    )

    db_instance_identifier = f"{new_cluster_name}-primary"
    print(f"Creating instance within cluster ({db_instance_identifier})...")
    rds.create_db_instance(
        DBClusterIdentifier=new_cluster_name,
        DBInstanceIdentifier=db_instance_identifier,
        Engine="aurora-postgresql",
        DBInstanceClass=args["instance_class"],
    )

    # Wait for instance to be available.
    print("  > Waiting for instance to be available")
    instance_waiter = rds.get_waiter('db_instance_available')
    instance_waiter.wait(
        DBInstanceIdentifier=db_instance_identifier,
        WaiterConfig={
            'MaxAttempts': 180
        },
    )
except ClientError as e:
    print("  > Unexpected error: %s" % e)
    sys.exit(1)
