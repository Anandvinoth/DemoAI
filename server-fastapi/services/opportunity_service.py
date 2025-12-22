# services/opportunity_service.py
import mysql.connector
from mysql.connector import Error
from model.opportunity import OpportunityCreate
from db.mysql_client import get_connection

#def get_connection():
#    return mysql.connector.connect(
#        host="localhost",
#        user="root",
#        password="root",
#        database="openvoice360"
    #)

async def create_opportunity(data: OpportunityCreate):
    """
    Insert an opportunity row using only Pydantic model (no SQLAlchemy)
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()

        sql = """
        INSERT INTO opportunities (
            opportunity_name, account_id, primary_contact_id, owner_id,
            stage, status, is_closed, is_won, expected_close_date, close_date,
            amount, currency, probability, forecast_category,
            lead_source, campaign_id, priority, next_step, deal_type, pipeline_id,
            description, pain_points, customer_needs, value_proposition, win_reason,
            loss_reason, record_type, tags, last_activity_date, last_contacted_date,
            next_activity_date, engagement_score
        )
        VALUES (
            %(opportunity_name)s, %(account_id)s, %(primary_contact_id)s, %(owner_id)s,
            %(stage)s, %(status)s, %(is_closed)s, %(is_won)s, %(expected_close_date)s, %(close_date)s,
            %(amount)s, %(currency)s, %(probability)s, %(forecast_category)s,
            %(lead_source)s, %(campaign_id)s, %(priority)s, %(next_step)s, %(deal_type)s, %(pipeline_id)s,
            %(description)s, %(pain_points)s, %(customer_needs)s, %(value_proposition)s, %(win_reason)s,
            %(loss_reason)s, %(record_type)s, %(tags)s, %(last_activity_date)s, %(last_contacted_date)s,
            %(next_activity_date)s, %(engagement_score)s
        )
        """


        cursor.execute(sql, data.dict())
        conn.commit()
        new_id = cursor.lastrowid

        return {"status": "success", "opportunity_id": new_id}

    except Error as e:
        print("MySQL Error:", e)
        return {"status": "error", "message": str(e)}

    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass


async def list_opportunities():
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM opportunities ORDER BY created_at ASC")
        rows = cursor.fetchall()

        return {"count": len(rows), "results": rows}

    except Error as e:
        return {"status": "error", "message": str(e)}

    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass
