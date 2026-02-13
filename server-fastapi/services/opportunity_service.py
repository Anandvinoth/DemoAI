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
    Insert or update an opportunity (voice-safe, no duplicates).
    Uses MySQL UNIQUE constraint on (opportunity_name, account_id).
    """

    try:
        conn = get_connection()
        cursor = conn.cursor()

        payload = data.dict(exclude_unset=True)

        # ❌ NEVER send generated column
        payload.pop("expected_revenue", None)

        # ✅ Safety fallback for owner_id (voice may miss it)
        if not payload.get("owner_id"):
            payload["owner_id"] = "SYSTEM"  # or a default sales queue user

        sql = """
        INSERT INTO opportunities (
            opportunity_name, account_id, primary_contact_id, owner_id,
            stage, status, is_closed, is_won,
            expected_close_date, close_date,
            amount, currency, probability, forecast_category,
            lead_source, campaign_id, priority, next_step,
            deal_type, pipeline_id,
            description, pain_points, customer_needs,
            value_proposition, win_reason, loss_reason,
            record_type, tags,
            last_activity_date, last_contacted_date,
            next_activity_date, engagement_score
        )
        VALUES (
            %(opportunity_name)s, %(account_id)s, %(primary_contact_id)s, %(owner_id)s,
            %(stage)s, %(status)s, %(is_closed)s, %(is_won)s,
            %(expected_close_date)s, %(close_date)s,
            %(amount)s, %(currency)s, %(probability)s, %(forecast_category)s,
            %(lead_source)s, %(campaign_id)s, %(priority)s, %(next_step)s,
            %(deal_type)s, %(pipeline_id)s,
            %(description)s, %(pain_points)s, %(customer_needs)s,
            %(value_proposition)s, %(win_reason)s, %(loss_reason)s,
            %(record_type)s, %(tags)s,
            %(last_activity_date)s, %(last_contacted_date)s,
            %(next_activity_date)s, %(engagement_score)s
        )
        ON DUPLICATE KEY UPDATE
            primary_contact_id = VALUES(primary_contact_id),
            owner_id = VALUES(owner_id),
            stage = VALUES(stage),
            status = VALUES(status),
            is_closed = VALUES(is_closed),
            is_won = VALUES(is_won),
            expected_close_date = VALUES(expected_close_date),
            close_date = VALUES(close_date),
            amount = VALUES(amount),
            currency = VALUES(currency),
            probability = VALUES(probability),
            forecast_category = VALUES(forecast_category),
            lead_source = VALUES(lead_source),
            campaign_id = VALUES(campaign_id),
            priority = VALUES(priority),
            next_step = VALUES(next_step),
            deal_type = VALUES(deal_type),
            pipeline_id = VALUES(pipeline_id),
            description = VALUES(description),
            pain_points = VALUES(pain_points),
            customer_needs = VALUES(customer_needs),
            value_proposition = VALUES(value_proposition),
            win_reason = VALUES(win_reason),
            loss_reason = VALUES(loss_reason),
            record_type = VALUES(record_type),
            tags = VALUES(tags),
            last_activity_date = VALUES(last_activity_date),
            last_contacted_date = VALUES(last_contacted_date),
            next_activity_date = VALUES(next_activity_date),
            engagement_score = VALUES(engagement_score)
        """

        cursor.execute(sql, payload)
        conn.commit()

        return {
            "status": "success",
            "message": "Opportunity created or updated successfully"
        }

    except Exception as e:
        print("MySQL Error:", e)
        raise

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
