from db.mysql_client import get_connection

def fetch_opportunity_analytics_rows():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
              o.opportunity_id,
              o.opportunity_name,
              o.account_id,
              a.account_name,
              a.industry,
              o.primary_contact_id,
              c.full_name AS primary_contact_name,
              o.owner_id,
              o.stage,
              o.status,
              o.is_closed,
              o.is_won,
              o.amount,
              o.currency,
              o.probability,
              o.expected_close_date,
              o.close_date,
              o.last_activity_date,
              o.next_activity_date,
              o.next_step,
              o.created_at,
              o.updated_at
            FROM opportunities o
            LEFT JOIN account a ON o.account_id = a.account_id
            LEFT JOIN contact c ON o.primary_contact_id = c.contact_id
        """)
        # print("Printing result from DB ::::::::::: " + cursor.fetchall());
        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()
