from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification
import torch

model_path = "./intent_model"
tokenizer = DistilBertTokenizerFast.from_pretrained(model_path)
model = DistilBertForSequenceClassification.from_pretrained(model_path)
model.eval()

def predict_intent(text: str):
    inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True)
    with torch.no_grad():
        logits = model(**inputs).logits
        probs = torch.softmax(logits, dim=1)[0]
        idx = torch.argmax(probs).item()
        conf = float(probs[idx])
    intent = model.config.id2label[idx]
    print(f"🗣️  '{text}' → intent: {intent} (confidence={conf:.3f})")

# --- Try some order-related queries ---
predict_intent("filter by currency USD")
predict_intent("filter by payment status refunded")
predict_intent("show orders with status shipped")

# --- Try product ones to verify backward compatibility ---
predict_intent("show me red drills")
predict_intent("find Makita products")
