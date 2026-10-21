<callout icon="🎯" color="blue_bg">
	**Stage:** S6 Queues & Async Processing · **Day 37** · **Planned:** 2.5 h · **Type:** Coding
	**Deliverable:** Order events via pub/sub exchange
	**Tracker row:** <mention-page url="https://app.notion.com/p/3f4bcc23fb65816db67dd2a50becba25"/>
</callout>
## 📌 Overview
- Aaj ka goal: RabbitMQ ko **zero se production-level** tak samajhna — exchange kaise route karta hai, ack kaise reliability deta hai, aur Node.js (TypeScript) me order-events pipeline banana.
- Is page me 12 topics covered hain: What is RabbitMQ → Install → Publish/Consume → Ack → AMQP & MQTT → Pub/Sub → Topic routing → DLX/DLQ → Exchanges & Queues → Persistence → Scalability → Specialized patterns.
- Har section ka structure: **pehle simple version** (ek-line summary → problem → steps → example → self-check) aur uske neeche **📚 Deep dive** (under the hood, Node.js analogy, gotchas). Pehli baar padh rahe ho to sirf simple version padho, revision me deep dive.
- End me: Production failure modes, runnable TS scaffold, Interview Q&A, Revision checklist.
- Mental model ek line me: **Producer → Exchange (routing brain) → Binding (rule) → Queue (buffer) → Consumer (ack deta hai)**.
- Pichle notes se connection: <mention-page url="https://app.notion.com/p/3f5bcc23fb6581208eebc9eb79a5dde1"/> — at-least-once, ordering, DLQ, backpressure ke broker-agnostic concepts wahan hain; yahan unka RabbitMQ (ack, DLX, prefetch) version hai.
## 🗺️ Mindmap
```mermaid
flowchart LR
    R["RabbitMQ"] --> A["Basics"]
    R --> B["Messaging Flow"]
    R --> C["Reliability"]
    R --> D["Scale and Patterns"]
    A --> A1["1. What is RabbitMQ"]
    A --> A2["2. Installing"]
    A --> A5["5. AMQP and MQTT"]
    B --> B3["3. Publish and Consume"]
    B --> B6["6. Pub/Sub"]
    B --> B7["7. Topic Routing"]
    B --> B9["9. Exchanges and Queues"]
    C --> C4["4. Acknowledgment"]
    C --> C8["8. DLX and DLQ"]
    C --> C10["10. Persistence and Durability"]
    D --> D11["11. Scalability and Load Balancing"]
    D --> D12["12. Specialized Queues and Patterns"]
    B9 --> E1["direct"]
    B9 --> E2["fanout"]
    B9 --> E3["topic"]
    B9 --> E4["headers"]
    D12 --> P1["Work queue"]
    D12 --> P2["RPC"]
    D12 --> P3["Priority"]
    D12 --> P4["Delayed and Retry"]
    D12 --> P5["Single active consumer"]
    D12 --> P6["Streams"]
```
---
## 1️⃣ What is RabbitMQ
<callout icon="💡" color="green_bg">
	**Ek line me:** RabbitMQ = **post office**. Producer chitthi (message) daalta hai, post office (broker) use sahi letterbox (queue) me pahunchata hai, aur consumer jab free ho tab letterbox se chitthi uthata hai.
</callout>
### 🧩 Problem kya hai?
- Bina broker ke `order-service` seedha `email-service` ko HTTP call karti hai.
- Email service down → **order fail**. Traffic spike → email service overload. Naya service jodna → order-service ka code badalna.
- Broker beech me aa jaaye to dono ek-doosre ko jaante hi nahi, bas queue se baat karte hain.
### 🧩 Kaise kaam karta hai (4 steps)
1. **Producer** message bhejta hai **exchange** ko.
2. **Exchange** rules (bindings) dekh kar tay karta hai ki kis **queue** me jaana hai.
3. **Queue** message ko tab tak sambhaal ke rakhti hai jab tak koi uthaye.
4. **Consumer** message uthata hai, kaam karta hai, aur **ack** deta hai ("ho gaya").
```mermaid
flowchart LR
    P["Producer"] --> X{{"Exchange"}}
    X -->|"binding rule"| Q["Queue"]
    Q --> C["Consumer"]
    C -->|"ack"| Q
```
### 🧩 Post office analogy
<table fit-page-width="true" header-row="true">
<tr>
<td>RabbitMQ term</td>
<td>Post office me</td>
</tr>
<tr>
<td>Producer</td>
<td>Chitthi bhejne wala</td>
</tr>
<tr>
<td>Exchange</td>
<td>Sorting office (chitthi chhaantta hai, rakhta nahi)</td>
</tr>
<tr>
<td>Binding</td>
<td>Sorting rule: "is pincode ki chitthi is letterbox me"</td>
</tr>
<tr>
<td>Queue</td>
<td>Letterbox (chitthi jama rehti hai)</td>
</tr>
<tr>
<td>Consumer</td>
<td>Chitthi uthane wala</td>
</tr>
</table>
### 🧪 Khud check karo
<details>
<summary>Q. Producer message seedha queue me daalta hai ya exchange ko bhejta hai?</summary>
	- **Exchange ko.** Exchange rules dekh ke queue chunta hai. (`sendToQueue` bhi default exchange se hi jaata hai.)
</details>
<details>
<summary>Q. Email service 10 minute down rahi to messages ka kya hoga?</summary>
	- Queue me jama rahenge, service wapas aane par process honge. Isi ko **decoupling + reliability** kehte hain.
</details>
<details>
<summary>Q. Exchange aur queue me kya fark hai?</summary>
	- Exchange sirf **route** karta hai, store nahi. Queue **store** karti hai.
</details>
### 📚 Deep dive
- **Message broker** hai — producer aur consumer ke beech me beech-ka-aadmi (middleman). Producer directly consumer ko call nahi karta.
- Written in **Erlang/OTP** → lightweight processes, fault-tolerance, clustering built-in.
- Core protocol: **AMQP 0-9-1** (plus MQTT, STOMP, AMQP 1.0 via plugins).
- **Smart broker, dumb consumer** model: routing logic broker me (exchanges + bindings), consumer sirf queue se leta hai.
- Kyun chahiye?
	- **Decoupling:** order-service ko pata nahi ki email-service ya billing-service exist karti hai ya nahi.
	- **Async processing:** heavy kaam (email, PDF, image resize) HTTP request ke bahar.
	- **Load levelling:** traffic spike aaye to queue buffer ban jaati hai, consumer apni speed se process karta hai.
	- **Reliability:** consumer down ho to message queue me safe rehta hai.
	- **Retry + DLQ:** failed jobs ko systematically handle karna.
- **Core terms:**
	- **Producer** → message bhejta hai
	- **Exchange** → message receive karke routing decide karta hai
	- **Binding** → exchange aur queue ke beech rule (binding key)
	- **Queue** → message ka buffer (FIFO)
	- **Consumer** → queue se message leke process karta hai
	- **Virtual host (vhost)** → logical namespace (multi-tenant isolation, jaise DB schema)
	- **Connection / Channel** → TCP connection ke andar lightweight virtual connections
- **Under the hood:**
	- Ek TCP **connection** costly hota hai → app me 1 (ya few) connection rakho.
	- Har thread/task ke liye alag **channel** (multiplexed over same TCP). Channel **thread-safe nahi** hota concurrent publishing ke liye (Node me single-thread hai to bhi ek channel per logical flow rakhna better).
- **JS/Node analogy:\~**
	- `EventEmitter` = in-process pub/sub. RabbitMQ = **network-wide, durable** EventEmitter.
	- Redis Pub/Sub = fire-and-forget (consumer offline to message gaya). RabbitMQ = queue me store hota hai.
	- BullMQ = Redis-based job queue. RabbitMQ = **routing flexibility + protocol standard** zyada.
	- Kafka = **log** (replay possible, consumer offset). RabbitMQ = **queue** (consume hone ke baad message delete).
<callout icon="⚖️" color="yellow_bg">
	**RabbitMQ vs Kafka (quick):** RabbitMQ → complex routing, per-message ack, task queues, low latency. Kafka → high-throughput event log, replay, partition ordering. (RabbitMQ Streams ab replay-style bhi deta hai.)
</callout>
---
## 2️⃣ Installing RabbitMQ
<callout icon="💡" color="green_bg">
	**Ek line me:** Docker ka **ek command** = RabbitMQ + Management UI ready. Baaki sab kuch baad ki baat.
</callout>
### 🧩 Sirf 4 steps me start
1. **Docker command chalao** (neeche deep dive me diya hai: image `rabbitmq:4-management`, user/pass `app`/`app`).
2. **Browser me** `http://localhost:15672` kholo → login `app` / `app` → queues, exchanges dikhenge.
3. **Project me** `npm i amqplib`.
4. **Connect test:**
```typescript
import amqp from "amqplib";
const conn = await amqp.connect("amqp://app:app@localhost:5672");
console.log("connected!");
await conn.close();
```
### 🧩 Sirf 2 ports yaad rakho (pehle)
<table fit-page-width="true" header-row="true">
<tr>
<td>Port</td>
<td>Kaun use karta hai</td>
</tr>
<tr>
<td>`5672`</td>
<td>**Aapka code** (AMQP)</td>
</tr>
<tr>
<td>`15672`</td>
<td>**Aap browser me** (Management UI)</td>
</tr>
</table>
### 🧪 Khud check karo
<details>
<summary>Q. Docker container delete karne par messages kyun gaye?</summary>
	- Volume mount nahi kiya tha. `/var/lib/rabbitmq` ko volume me daalo to data bachta hai.
</details>
<details>
<summary>Q. `guest/guest` production me kyun nahi?</summary>
	- Default, sab ko pata hai; sirf [localhost](http://localhost) se allowed hota hai. Naya user + vhost + least-privilege permissions banao.
</details>
### 📚 Deep dive
- **Sabse easy: Docker** (Management UI ke saath):
```bash
docker run -d --name rabbitmq \
  -p 5672:5672 -p 15672:15672 -p 1883:1883 \
  -e RABBITMQ_DEFAULT_USER=app \
  -e RABBITMQ_DEFAULT_PASS=app \
  rabbitmq:4-management
```
- **Ports yaad rakho:**
	- `5672` → AMQP (apps yahan connect karti hain)
	- `5671` → AMQP over TLS (production)
	- `15672` → Management UI + HTTP API
	- `1883` → MQTT (plugin enable ho tab)
	- `25672` → inter-node clustering, `4369` → epmd (node discovery)
- **Plugins enable karna:**
```bash
docker exec rabbitmq rabbitmq-plugins enable rabbitmq_mqtt rabbitmq_shovel rabbitmq_shovel_management
```
- **Docker Compose (project me use karo):**
```yaml
services:
  rabbitmq:
    image: rabbitmq:4-management
    ports: ["5672:5672", "15672:15672"]
    environment:
      RABBITMQ_DEFAULT_USER: app
      RABBITMQ_DEFAULT_PASS: app
    volumes:
      - rabbit_data:/var/lib/rabbitmq   # persistence ke liye zaroori
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
volumes:
  rabbit_data:
```
- **Useful CLI:**
	- `rabbitmqctl list_queues name messages_ready messages_unacknowledged`
	- `rabbitmqctl list_exchanges`, `list_bindings`, `list_connections`
	- `rabbitmq-diagnostics status`
- **Management UI** (`http://localhost:15672`): queues, exchanges, message rates, **"Get messages"** se peek, publish test message.
- **Gotchas:**
	- Default `guest/guest` user **sirf **[**localhost**](http://localhost) se allowed hota hai → production me kabhi use mat karo, naya user + vhost + least-privilege permissions banao.
	- Volume mount nahi kiya to container delete = saara data gaya.
	- Node name / hostname change hone par Mnesia data issue — Docker me fixed `hostname` do.
- **Node.js client install:**
```bash
npm i amqplib
npm i -D typescript tsx @types/amqplib @types/node
```
---
## 3️⃣ Publishing and Consuming Messages
<callout icon="💡" color="green_bg">
	**Ek line me:** **Publish** = chitthi post karna (exchange ko), **Consume** = letterbox (queue) se chitthi nikalna. Beech me **setup** (exchange + queue + binding) ek baar hota hai.
</callout>
### 🧩 Publisher code ke 2 hisse (aapke mail example jaisa)
<table fit-page-width="true" header-row="true">
<tr>
<td>Line</td>
<td>Kya karti hai</td>
<td>Kyun zaruri</td>
</tr>
<tr>
<td>`amqp.connect(url)`</td>
<td>Broker se TCP connection</td>
<td>Bina iske baat hi nahi</td>
</tr>
<tr>
<td>`createChannel()`</td>
<td>Connection ke andar virtual line</td>
<td>Saare commands channel par chalte hain</td>
</tr>
<tr>
<td>`assertExchange(...)`</td>
<td>Exchange hai? nahi to bana do</td>
<td>Nahi hoga to publish error</td>
</tr>
<tr>
<td>`assertQueue(...)`</td>
<td>Queue hai? nahi to bana do</td>
<td>Message rakhne ki jagah</td>
</tr>
<tr>
<td>`bindQueue(queue, exchange, key)`</td>
<td>Rule: is key ka message is queue me</td>
<td>**Bina binding ke message silently drop**</td>
</tr>
<tr>
<td>`publish(exchange, key, Buffer)`</td>
<td>Message bhejna</td>
<td>Broker sirf bytes leta hai, isliye `Buffer.from(JSON.stringify(obj))`</td>
</tr>
</table>
### 🧩 Consume ke 3 steps
1. `ch.prefetch(n)` → ek saath kitne messages lene hain.
2. `ch.consume(queue, handler)` → broker message **push** karta hai.
3. Handler me kaam karke `ch.ack(msg)` → "ho gaya".
### 🧪 Khud check karo
<details>
<summary>Q. Message ko Buffer kyun banate hain?</summary>
	- RabbitMQ sirf bytes samajhta hai. Object → `JSON.stringify` → `Buffer.from`.
</details>
<details>
<summary>Q. Exchange, queue dono bane hon par message queue me nahi aaya. Pehla shak kispar?</summary>
	- **Binding** missing hai ya routing key match nahi ho rahi.
</details>
<details>
<summary>Q. `publish` ka "sent" print hone ka matlab broker ne le liya?</summary>
	- Nahi. Pakka karne ke liye **publisher confirms** (`createConfirmChannel`) chahiye.
</details>
### 📚 Deep dive
- **Publish flow:** `channel.publish(exchange, routingKey, content, options)`
	- `content` hamesha **Buffer** hota hai → JSON ko `Buffer.from(JSON.stringify(obj))` karo.
	- Important options: `persistent: true`, `contentType`, `messageId`, `correlationId`, `replyTo`, `expiration`, `headers`, `mandatory`.
- **Default exchange (****`""`****):** ek nameless **direct** exchange; har queue automatically apne **queue name** se bind hoti hai. Isiliye `sendToQueue("jobs", buf)` seedha queue me jaata hai (actually default exchange + routingKey = queue name).
- **Consume flow:** `channel.consume(queue, handler, { noAck: false })`
	- Broker message **push** karta hai (polling nahi) — `prefetch` limit tak.
	- `basic.get` pull-style hai — slow, avoid karo (sirf rare cases).
- **Message anatomy:** body (bytes) + properties (metadata) + routing key + delivery-tag (channel-scoped number jo ack me use hota hai) + `redelivered` flag.
- **Minimal publisher/consumer:**
```typescript
import amqp from "amqplib";

const conn = await amqp.connect("amqp://app:app@localhost:5672");
const ch = await conn.createChannel();

await ch.assertQueue("jobs", { durable: true });

// producer
ch.sendToQueue("jobs", Buffer.from(JSON.stringify({ id: 1 })), { persistent: true });

// consumer
await ch.prefetch(5);
await ch.consume("jobs", (msg) => {
  if (!msg) return; // consumer cancel hua
  const job = JSON.parse(msg.content.toString());
  console.log("got", job);
  ch.ack(msg);
});
```
- **Publisher confirms** (important!): normal `publish()` fire-and-forget hai — broker ne receive kiya ya nahi pata nahi chalta.
	- `createConfirmChannel()` use karo → broker `basic.ack` bhejta hai jab message queue(s) tak safely pahunch jaye (durable queue me disk pe).
	- `publish()` ka return value `false` = internal buffer full → `drain` event ka wait karo (**backpressure**, Node streams jaisa).
- **Mandatory flag:** `mandatory: true` + `channel.on("return", ...)` → agar message kisi queue me route nahi hua to wapas milta hai (warna **silently drop** ho jaata hai!).
- **JS/Node analogy:** `ch.consume` ≈ `emitter.on("event", handler)` but network ke upar, with ack. `prefetch` ≈ concurrency limit (jaise `p-limit`).
- **Gotchas:**
	- Handler me `async` error throw hua aur ack/nack nahi kiya → message **unacked** pada rahega jab tak channel close na ho.
	- Same queue ko alag arguments se `assertQueue` kiya → `PRECONDITION_FAILED` error, channel close.
	- JSON parse error ko handle karo → warna poison message loop.
---
## 4️⃣ Message Acknowledgment
<callout icon="💡" color="green_bg">
	**Ek line me:** Ack = **parcel par signature**. Jab tak delivery wale ko signature nahi mila, parcel uske record me "pending" rehta hai. Signature se pehle gum ho gaya to parcel dobara bheja jaata hai.
</callout>
### 🧩 Kya hota hai (timeline)
1. Broker message consumer ko deta hai, par queue se **delete nahi** karta.
2. Consumer kaam karta hai (DB save, email bhejna...).
3. Kaam **poora hone ke baad** `ack` bhejta hai → broker ab message delete karta hai.
4. Beech me consumer crash hua → ack nahi aaya → broker message **dobara** deta hai (isliye duplicate possible).
### 🧩 4 tareeke, ek table me
<table fit-page-width="true" header-row="true">
<tr>
<td>Kya</td>
<td>Matlab</td>
<td>Kab</td>
</tr>
<tr>
<td>`ch.ack(msg)`</td>
<td>Success, delete karo</td>
<td>Kaam ho gaya</td>
</tr>
<tr>
<td>`ch.nack(msg, false, true)`</td>
<td>Fail, **queue me wapas** daalo</td>
<td>Temporary error (limit ke saath!)</td>
</tr>
<tr>
<td>`ch.nack(msg, false, false)`</td>
<td>Fail, **wapas mat daalo** (DLX me jaayega)</td>
<td>Permanent error / poison</td>
</tr>
<tr>
<td>`noAck: true` (auto-ack)</td>
<td>Milte hi delete</td>
<td>Sirf non-critical data; crash par loss</td>
</tr>
</table>
### 🧩 Golden rule
- **Ack hamesha kaam ke BAAD.** Pehle ack kiya aur DB fail hua → message hamesha ke liye gaya.
```typescript
await ch.consume("jobs", async (msg) => {
  if (!msg) return;
  try {
    await saveToDb(JSON.parse(msg.content.toString())); // pehle kaam
    ch.ack(msg);                                        // phir ack
  } catch {
    ch.nack(msg, false, false);                         // fail → DLX
  }
});
```
- **Prefetch** = ek consumer ko ek time par kitne **unacked** messages mil sakte hain. `prefetch(1)` = ek ek karke, fair.
### 🧪 Khud check karo
<details>
<summary>Q. Ack kab nahi karna chahiye?</summary>
	- Kaam poora hone se pehle. Warna crash par message lost (at-most-once ban jaata hai).
</details>
<details>
<summary>Q. `nack(requeue=true)` bina limit ke kya problem?</summary>
	- Poison message baar baar wapas aayega → infinite loop, CPU burn. Limit lagao (retry counter / `x-delivery-limit`) ya DLX.
</details>
<details>
<summary>Q. Consumer crash hua to message ka kya hota hai?</summary>
	- Ack nahi aaya to broker use dobara deta hai (`redelivered: true`). Isliye consumer **idempotent** hona chahiye.
</details>
### 📚 Deep dive
- **Ack = consumer broker ko bolta hai: "Message process ho gaya, ab delete kar do."**
- Bina ack ke message queue se hataya nahi jaata → consumer crash hua to **redeliver** hota hai (at-least-once delivery).
- **Teen tareeke:**
	- `ch.ack(msg)` → success, delete karo.
	- `ch.nack(msg, allUpTo, requeue)` → failure; `requeue=true` queue me wapas, `false` → drop ya **DLX** me.
	- `ch.reject(msg, requeue)` → nack jaisa, but ek message ke liye.
- **`allUpTo`**** (multiple ack):** `ack(msg, true)` → us delivery-tag tak ke saare pending messages ack. Throughput badhta hai.
- **Auto-ack (****`noAck: true`****):** message deliver hote hi delete → consumer crash par **message lost**. Sirf non-critical data ke liye.
- **Prefetch (****`basic.qos`****):** ek consumer ko kitne **unacked** messages tak push ho sakte hain.
	- `prefetch(1)` → fair dispatch, slow consumer ko zyada nahi milega.
	- Bahut high / 0 (unlimited) → ek consumer saare messages hog kar lega, memory spike.
	- Thumb rule: I/O-bound handler → 10–50; CPU-heavy → 1–2.
- **Ack timeout:** RabbitMQ me `consumer_timeout` (default **30 min**) — isse zyada unacked raha to channel close with `PRECONDITION_FAILED`. Long jobs ke liye either timeout badhao ya job ko chunks me todo.
- **Redelivered flag:** `msg.fields.redelivered === true` → ye message pehle bhi deliver ho chuka hai (duplicate ho sakta hai) → **idempotency** check karo.
- **Delivery guarantee ka full picture:**
	- **Producer side:** publisher confirms
	- **Broker side:** durable queue + persistent message (quorum queue best)
	- **Consumer side:** manual ack **after** successful processing
	- Teeno mile to **at-least-once**. Exactly-once practically nahi — **idempotent consumer** banao.
- **Ack kab karna hai?** Business logic + DB commit **ke baad**. Pehle ack kiya aur DB fail → message lost.
```mermaid
sequenceDiagram
    participant P as Producer
    participant B as Broker
    participant C as Consumer
    P->>B: publish (persistent)
    B-->>P: confirm (ack)
    B->>C: deliver (delivery tag 7)
    C->>C: process + DB commit
    alt success
        C->>B: ack(7)
        B->>B: delete message
    else failure
        C->>B: nack(7, requeue=false)
        B->>B: route to DLX
    else consumer crash
        B->>B: connection closed, requeue as redelivered
    end
```
- **JS/Node analogy:** Ack ≈ DB transaction `COMMIT`. Handler me `try { ... ack } catch { nack }` pattern `try/catch/finally` jaisa socho.
- **Gotchas:**
	- **Double ack** (same tag do baar) → channel error `PRECONDITION_FAILED unknown delivery tag`.
	- Ack **usi channel** pe karna hota hai jis par message mila (delivery tag channel-scoped).
	- `nack(requeue=true)` bina limit ke → **infinite poison loop** (CPU burn). Always limit karo (quorum `x-delivery-limit` ya retry counter).
---
## 5️⃣ AMQP & MQTT
<callout icon="💡" color="green_bg">
	**Ek line me:** Protocol = **bhasha**. **AMQP** = servers ke beech reliable, formal courier ki bhasha. **MQTT** = chhote devices (sensors) ki halki SMS jaisi bhasha. RabbitMQ dono samajhta hai.
</callout>
### 🧩 Kab kaunsa
<table fit-page-width="true" header-row="true">
<tr>
<td></td>
<td>AMQP 0-9-1</td>
<td>MQTT</td>
</tr>
<tr>
<td>Kaun use kare</td>
<td>Backend services (aap)</td>
<td>IoT devices, mobile</td>
</tr>
<tr>
<td>Routing</td>
<td>Exchange + binding (rich)</td>
<td>Sirf topic string</td>
</tr>
<tr>
<td>Port</td>
<td>`5672`</td>
<td>`1883`</td>
</tr>
</table>
### 🧩 Dono ek saath kaise kaam karte hain
- Sensor MQTT me publish karta hai: `sensors/room1/temp`.
- RabbitMQ (`rabbitmq_mqtt` plugin) `/` ko `.` bana deta hai: `sensors.room1.temp` aur `amq.topic` exchange me daalta hai.
- Backend service AMQP se `sensors.#` bind karke wahi message padh leti hai.
```mermaid
flowchart LR
    S["Sensor (MQTT)"] -->|"sensors/room1/temp"| X{{"amq.topic"}}
    X -->|"sensors.#"| Q["backend queue (AMQP)"]
```
### 🧪 Khud check karo
<details>
<summary>Q. Backend microservices ke liye AMQP ya MQTT?</summary>
	- **AMQP.** Rich routing, acks, DLX. MQTT IoT/low-bandwidth ke liye hai.
</details>
<details>
<summary>Q. MQTT topic `a/b/c` AMQP me kya banta hai?</summary>
	- Routing key `a.b.c` (slash → dot), exchange `amq.topic`.
</details>
### 📚 Deep dive
- **AMQP 0-9-1** (RabbitMQ ka native protocol):
	- **Binary, application-layer** protocol; broker-side model standardized: exchange, queue, binding.
	- Frames: connection → channel → methods (`queue.declare`, `basic.publish`, `basic.consume`, `basic.ack`).
	- Features: routing, acks, confirms, TTL, DLX, priorities, transactions (slow — confirms prefer karo).
	- Best for: **server-to-server** reliable messaging (microservices).
- **AMQP 1.0:** alag, newer standard (ISO). RabbitMQ 4.x me **native** support. Different model (links, settle modes) — interview me sirf difference pata ho: **0-9-1 ≠ 1.0, not wire-compatible**.
- **MQTT:**
	- **Lightweight** pub/sub protocol — **IoT**, mobile, low-bandwidth devices.
	- Model: **topic-based** (`sensors/room1/temp`), broker se **publish/subscribe**; queue/exchange ka concept client ko nahi dikhta.
	- **QoS levels:** `0` at-most-once, `1` at-least-once, `2` exactly-once (RabbitMQ QoS 2 ko QoS 1 treat karta hai).
	- **Retained messages, Last Will & Testament (LWT)** — device offline detection.
- **RabbitMQ me MQTT kaise kaam karta hai** (`rabbitmq_mqtt` plugin):
	- MQTT topic `a/b/c` → AMQP routing key `a.b.c` (slash → dot).
	- Default exchange: **`amq.topic`** (topic exchange).
	- MQTT subscriber ke liye internally queue bante hain.
	- Matlab IoT device MQTT se publish kare aur backend service AMQP se `sensors.#` pe consume kare — **protocol bridge**.
	- MQTT wildcard: `+` (single level) ≈ AMQP `*`, `#` (multi level) ≈ AMQP `#`.
- **Comparison table:**
<table fit-page-width="true" header-row="true">
<tr>
<td>Point</td>
<td>AMQP 0-9-1</td>
<td>MQTT</td>
</tr>
<tr>
<td>Use case</td>
<td>Microservices, job queues</td>
<td>IoT, mobile, telemetry</td>
</tr>
<tr>
<td>Routing</td>
<td>Exchange + binding (rich)</td>
<td>Topic string only</td>
</tr>
<tr>
<td>Reliability</td>
<td>Ack, confirms, DLX</td>
<td>QoS 0/1/2</td>
</tr>
<tr>
<td>Overhead</td>
<td>Medium</td>
<td>Very low (2 byte header)</td>
</tr>
<tr>
<td>Port</td>
<td>5672</td>
<td>1883 / 8883 TLS</td>
</tr>
</table>
- **JS/Node analogy:** AMQP ≈ gRPC/HTTP2 jaisa structured server protocol; MQTT ≈ WebSocket-style lightweight pub/sub (Node me `mqtt` npm package).
```typescript
// MQTT client (npm i mqtt)
import mqtt from "mqtt";
const c = mqtt.connect("mqtt://localhost:1883", { username: "app", password: "app" });
c.on("connect", () => c.publish("sensors/room1/temp", "27.5", { qos: 1 }));
// AMQP side par routing key: sensors.room1.temp (amq.topic exchange)
```
---
## 6️⃣ Pub/Sub Model
<callout icon="💡" color="green_bg">
	**Ek line me:** Pub/Sub = **YouTube channel**. Ek video upload hota hai aur **har subscriber ko apni notification** milti hai. Work queue = **ek counter par line**, jahan har customer ko sirf ek cashier milta hai.
</callout>
### 🧩 Work queue vs Pub/Sub (sabse zaruri difference)
<table fit-page-width="true" header-row="true">
<tr>
<td></td>
<td>Work queue</td>
<td>Pub/Sub</td>
</tr>
<tr>
<td>Queues</td>
<td>**Ek** queue</td>
<td>**Har subscriber ki apni** queue</td>
</tr>
<tr>
<td>Message kise</td>
<td>Sirf **ek** consumer ko</td>
<td>**Sabko** (copy)</td>
</tr>
<tr>
<td>Use</td>
<td>Kaam baantna (email jobs)</td>
<td>Event batana (order.created)</td>
</tr>
</table>
### 🧩 Order event example (4 steps)
1. `order-service` `order.created` event publish karta hai.
2. Exchange (fanout/topic) teeno bound queues me **copy** daalta hai.
3. `billing`, `email`, `analytics` apni queue se **independently** padhte hain.
4. Nayi `fraud` service chahiye? Bas ek nayi queue bind karo, **producer ka code same**.
```mermaid
flowchart LR
    P["order-service"] --> X{{"orders.events"}}
    X --> Q1["billing.queue"]
    X --> Q2["email.queue"]
    X --> Q3["analytics.queue"]
```
### 🧪 Khud check karo
<details>
<summary>Q. Do services ne same queue share ki to kya hoga?</summary>
	- Pub/sub nahi rahega; wo **competing consumers** ban jaayenge aur message sirf ek ko milega (bug).
</details>
<details>
<summary>Q. Fanout exchange me koi queue bound nahi hai, message ka kya?</summary>
	- Drop ho jaata hai. Consumers start hone se pehle topology declare karo.
</details>
<details>
<summary>Q. Naya subscriber jodna ho to producer badalna padega?</summary>
	- Nahi. Bas nayi queue bind karo. Yahi decoupling hai.
</details>
### 📚 Deep dive
- **Pub/Sub:** ek publisher, **many independent subscribers** — har subscriber ko message ki **apni copy** milti hai.
- **Queue vs Pub/Sub — confusion clear karo:**
	- **Work queue (competing consumers):** ek queue, many consumers → har message **sirf ek** consumer ko.
	- **Pub/Sub:** **ek queue per subscriber**, sab queues same exchange se bound → har queue ko copy.
- **RabbitMQ me pub/sub = Fanout (ya Topic) exchange + per-service queue.**
- **Order events example (aaj ka deliverable):**
	- `order-service` → `orders.events` exchange pe `order.created` publish karta hai.
	- `billing-queue`, `email-queue`, `analytics-queue` — teeno bound hain → teeno ko copy.
	- Nayi service (e.g. `fraud`) aayi? Bas ek nayi queue bind karo — **producer code change nahi**. Yahi decoupling hai.
```mermaid
flowchart LR
    P["order-service"] -->|"order.created"| X{{"orders.events (topic)"}}
    X -->|"order.*"| Q1["billing.queue"]
    X -->|"order.created"| Q2["email.queue"]
    X -->|"#"| Q3["analytics.queue"]
    Q1 --> C1["billing-service x3"]
    Q2 --> C2["email-service"]
    Q3 --> C3["analytics-service"]
```
- **Temporary subscribers:** exclusive, auto-delete, server-named queue (`queue: ""`, `exclusive: true`) — jaise live dashboards; disconnect = queue gone.
- **Durable subscribers:** named durable queue — subscriber offline ho tab bhi messages jama hote rehte hain.
- **Event vs Command:**
	- **Event** (`order.created`): past tense, "kuch ho chuka" — many subscribers.
	- **Command** (`send.email`): ek specific handler ko instruction — usually work queue.
- **JS/Node analogy:** `emitter.emit("order.created")` → `emitter.on(...)` many listeners. Bas yahan **process boundary + durability** add ho gaya.
- **Gotchas:**
	- Fanout me **queue bind nahi ki to message gayab** (kisi queue ko nahi mila = dropped). Consumers start hone se pehle topology declare karo.
	- Same queue ko 2 services share kar rahi hain → pub/sub nahi rahega, **competing consumers** ban jaayenge (bug!).
---
## 7️⃣ Message Routing with Topics
<callout icon="💡" color="green_bg">
	**Ek line me:** Topic exchange = **direct exchange + pattern matching**. Producer message par ek **address (routing key)** likhta hai, har queue apna **filter pattern (binding key)** deti hai, aur exchange dono ko match karke decide karta hai ki message kis-kis queue me jaayega.
</callout>
### 🧩 Step 0 — Problem kya hai? (kyun chahiye)
- **Direct exchange** me match **exact** hota hai: `send_mail` bheja to sirf `send_mail` binding wali queue ko milega.
- Real system me aisa chahiye:
	- **Billing** ko saare order events (`order.created`, `order.paid`, `order.cancelled`)
	- **Analytics** ko sab kuch
	- **Alerts** ko sirf failed events (`payment.failed`, `order.failed`)
- Direct me har event ke liye alag binding likhni padegi, aur naya event aaya to binding badalni padegi.
- **Topic exchange** me ek pattern likho aur ek saath kai events pakdo.
### 🧩 Step 1 — Do keys, do alag kaam (sabse zyada confusion yahin hota hai)
<table fit-page-width="true" header-row="true">
<tr>
<td></td>
<td>Routing key</td>
<td>Binding key</td>
</tr>
<tr>
<td>Kaun deta hai</td>
<td>**Producer**</td>
<td>**Queue / consumer side** (`bindQueue` me)</td>
</tr>
<tr>
<td>Kab</td>
<td>Har `publish` ke saath</td>
<td>Ek baar, setup me</td>
</tr>
<tr>
<td>Kya hai</td>
<td>Message ka **address / label**</td>
<td>Queue ka **filter / pattern**</td>
</tr>
<tr>
<td>Wildcard (`*`, `#`)</td>
<td>❌ Nahi chalta (literal text)</td>
<td>✅ Sirf yahan chalta hai</td>
</tr>
<tr>
<td>Example</td>
<td>`order.created`</td>
<td>`order.*`</td>
</tr>
</table>
- **Code me kahan:**
```typescript
channel.bindQueue("billing", "events", "order.*");          // 3rd argument = BINDING key (pattern)
channel.publish("events", "order.created", Buffer.from("...")); // 2nd argument = ROUTING key (address)
```
### 🧩 Step 2 — Routing key ka format
- **Dot se alag kiye hue words**, jaise ek address: `country.state.city` → `india.up.noida`.
- Topic example: `order.created`, `payment.failed`, `order.created.india` (max 255 bytes).
- Har dot-separated hissa = **ek word**. Wildcards inhi words par kaam karte hain.
### 🧩 Step 3 — Sirf 2 wildcards (binding key me)
- `*` → **exactly ek** word (na kam, na zyada)
- `#` → **zero ya zyada** words
- Address analogy: `india.*` = india ke andar **ek level** (`india.up`); `india.#` = india ke andar **kitna bhi deep** (`india.up.noida.sector62`).
### 🧩 Step 4 — Exchange kaise decide karta hai (3 steps)
1. Producer ne message bheja with routing key (e.g. `order.created.india`).
2. Exchange apni **saari bindings** check karta hai: "is key ko kis-kis binding ka pattern pakad raha hai?"
3. Jitni queues ki binding match hui, **un sab queues me message ki ek-ek copy** jaati hai. Koi match nahi → message **drop** (jab tak alternate exchange / `mandatory` na ho).
### 🧩 Step 5 — Poora example (3 queues, 3 messages)
```mermaid
flowchart LR
    P["Producer"] -->|"order.created"| X{{"events (topic)"}}
    P -->|"order.created.india"| X
    P -->|"payment.failed"| X
    X -->|"binding: order.*"| B["billing queue"]
    X -->|"binding: #"| A["analytics queue"]
    X -->|"binding: *.failed"| L["alerts queue"]
```
<table fit-page-width="true" header-row="true">
<tr>
<td>Routing key (message)</td>
<td>billing (`order.*`)</td>
<td>analytics (`#`)</td>
<td>alerts (`*.failed`)</td>
</tr>
<tr>
<td>`order.created`</td>
<td>✅</td>
<td>✅</td>
<td>❌</td>
</tr>
<tr>
<td>`order.created.india`</td>
<td>❌ (3 words, `*` sirf 1)</td>
<td>✅</td>
<td>❌</td>
</tr>
<tr>
<td>`payment.failed`</td>
<td>❌</td>
<td>✅</td>
<td>✅</td>
</tr>
</table>
- **Dhyan do:** `order.*` ne `order.created.india` ko **nahi** pakda kyunki `*` = ek hi word. `order.#` hota to pakad leta.
### 🧩 Step 6 — Code (direct wale mail example se bas 2 cheezein badli)
```typescript
// 1) exchange type: "direct" → "topic"
await channel.assertExchange("events", "topic", { durable: true });

// 2) binding key me pattern
await channel.assertQueue("billing", { durable: true });
await channel.bindQueue("billing", "events", "order.*");

await channel.assertQueue("alerts", { durable: true });
await channel.bindQueue("alerts", "events", "*.failed");

// publish: routing key normal text (wildcard nahi)
channel.publish("events", "order.created", Buffer.from("{}"));   // → billing
channel.publish("events", "payment.failed", Buffer.from("{}"));  // → alerts
```
### 📋 Cheat-sheet: pattern vs key
- **Examples:**
<table fit-page-width="true" header-row="true">
<tr>
<td>Binding key</td>
<td>`order.created`</td>
<td>`order.created.in`</td>
<td>`payment.failed`</td>
</tr>
<tr>
<td>`order.*`</td>
<td>✅</td>
<td>❌</td>
<td>❌</td>
</tr>
<tr>
<td>`order.#`</td>
<td>✅</td>
<td>✅</td>
<td>❌</td>
</tr>
<tr>
<td>`*.failed`</td>
<td>❌</td>
<td>❌</td>
<td>✅</td>
</tr>
<tr>
<td>`#`</td>
<td>✅</td>
<td>✅</td>
<td>✅</td>
</tr>
</table>
### 📚 Deep dive
- **Special cases:**
	- Binding `#` alone = **fanout jaisa** (sab kuch).
	- Binding me koi wildcard nahi = **direct jaisa** (exact match).
- **Ek message multiple bindings match kare** to bhi queue ko **ek hi copy** milti hai (same queue ke 2 bindings match hone par duplicate nahi).
- **Routing key design (production tip):** `<domain>.<entity>.<event>.<version/region>` — e.g. `shop.order.created.v1`. Consistent naming, warna wildcard bindings mess ho jaate hain.
- **Direct exchange** quick compare: exact match, e.g. log levels `error`, `warn`.
- **Headers exchange:** routing key ignore, message **headers** match (`x-match: all | any`) — rarely use.
- **Alternate exchange (AE):** unroutable messages ko catch karne ka safety net → exchange declare karte waqt `alternateExchange` argument.
```typescript
await ch.assertExchange("unrouted", "fanout", { durable: true });
await ch.assertExchange("orders.events", "topic", {
  durable: true,
  alternateExchange: "unrouted", // koi binding match nahi → yahan jaayega
});
```
- **JS/Node analogy:** topic binding ≈ **glob pattern / route matching** (`express` route params ya `minimatch`) but words dot-separated; `#` ≈ `**`, `*` ≈ `*`.
- **Gotchas:**
	- `order.*` se `order.created.in` match **nahi** hota (ek hi word).
	- Routing key me wildcard publish time par literal treat hota hai — wildcard sirf **binding** me chalta hai.
	- Binding key ko routing key samajh ke `publish("events", "order.*", ...)` mat karo — wo literal string `order.*` ban jaayegi, kisi pattern se match nahi hogi.
- **Common confusions (quick fix):**
	- "`#` aur `*` me fark?" → `*` = **exactly 1** word, `#` = **0 ya zyada**.
	- "Routing key kaun likhta hai?" → **Producer**. "Binding key?" → **Queue banane/bind karne wala (consumer side)**.
	- "Queue ko duplicate copy milegi agar 2 bindings match hui?" → Nahi, ek hi copy.
	- "Direct aur topic me kab kya?" → Exact label chahiye to direct; pattern/grouping chahiye to topic.
- **🧪 Khud check karo (answer toggle me):**
<details>
<summary>Q. Binding `*.created` aur message `order.created` — match?</summary>
	- ✅ Haan. `*` = `order` (ek word), phir `.created`.
</details>
<details>
<summary>Q. Binding `order.#` aur message `order` — match?</summary>
	- ✅ Haan. `#` zero words bhi ho sakta hai, isliye `order` akela bhi match.
</details>
<details>
<summary>Q. Binding `order.*` aur message `order` — match?</summary>
	- ❌ Nahi. `*` ko exactly ek word chahiye, yahan zero hai.
</details>
<details>
<summary>Q. Binding `#.failed` aur message `payment.retry.failed` — match?</summary>
	- ✅ Haan. `#` = `payment.retry`, phir `.failed`.
</details>
<details>
<summary>Q. Ek queue ki 2 bindings (`order.*` aur `#`) hain, message `order.created` aaya — kitni copy?</summary>
	- **1 copy.** Ek queue ko ek message ek hi baar milta hai.
</details>
---
## 8️⃣ Dead Letter Exchanges (DLX) and Queues (DLQ)
<callout icon="💡" color="green_bg">
	**Ek line me:** DLQ = **"lost & found / quarantine box"**. Jo message baar-baar fail hota hai use main queue se hata kar yahan rakh do, taaki baaki messages na atkein aur aap baad me aaram se dekh sako.
</callout>
### 🧩 Problem kya hai?
- Ek **poison message** (bad data/bug) har baar fail hota hai.
- Bina DLQ ke: baar-baar retry → CPU burn, queue ke peeche wale messages atak jaate hain.
### 🧩 Kaise kaam karta hai (5 steps)
1. Consumer message par fail hota hai → `nack(msg, false, false)` (**requeue = false**).
2. Broker dekhta hai ki queue par **DLX** set hai.
3. Message DLX (ek normal exchange) par chala jaata hai.
4. DLX use **DLQ** (ek normal queue) me daal deta hai.
5. Aap alert dekh kar message inspect karte ho, bug fix karke **replay** karte ho.
```mermaid
flowchart LR
    M["main queue"] -->|"nack requeue=false"| D{{"DLX"}}
    D --> Q["DLQ (manual review)"]
```
### 🧩 Message "dead" kab hota hai? (4 reasons)
<table fit-page-width="true" header-row="true">
<tr>
<td>Reason</td>
<td>Matlab</td>
</tr>
<tr>
<td>nack / reject (requeue=false)</td>
<td>Consumer ne manually reject kiya</td>
</tr>
<tr>
<td>TTL expire</td>
<td>Message bahut der queue me pada raha</td>
</tr>
<tr>
<td>Queue full</td>
<td>`x-max-length` cross hua</td>
</tr>
<tr>
<td>Delivery limit</td>
<td>Quorum queue me `x-delivery-limit` se zyada redeliver</td>
</tr>
</table>
### 🧩 Setup ka minimum (queue ke 2 arguments)
```typescript
await ch.assertQueue("billing.queue", {
  durable: true,
  arguments: {
    "x-dead-letter-exchange": "orders.dlx",   // dead hone par yahan jaao
    "x-dead-letter-routing-key": "billing",   // is key se DLQ tak
  },
});
// DLQ: "billing.dlq" ko "orders.dlx" se "billing" key par bind karo
```
### 🧪 Khud check karo
<details>
<summary>Q. DLX aur DLQ me fark?</summary>
	- **DLX** ek exchange hai (router). **DLQ** ek queue hai (store). DLX dead messages ko DLQ tak pahunchata hai.
</details>
<details>
<summary>Q. DLQ me message aane par pehla kadam?</summary>
	- Payload + `x-death` header dekh ke root cause samjho, fix karo, phir replay karo (consumer idempotent ho).
</details>
<details>
<summary>Q. Retry with delay kaise karte hain?</summary>
	- Fail → DLX → **retry queue** (`x-message-ttl: 10000`, uska DLX wapas main exchange). 10 sec baad message wapas main queue me.
</details>
### 📚 Deep dive
- **DLX:** ek normal exchange jisko queue "dead" messages bhejti hai. **DLQ:** wo queue jo DLX se bound hai aur dead messages store karti hai (investigation/replay ke liye).
- **Message "dead" kab hota hai?**
	- Consumer ne `nack/reject` kiya with `requeue=false`
	- **TTL expire** ho gayi (message ya queue level)
	- Queue ki **max-length / max-bytes** overflow hui (`x-overflow: drop-head` default)
	- Quorum queue me **`x-delivery-limit`** cross hua (poison message)
- **Setup:** queue declare karte waqt arguments:
	- `x-dead-letter-exchange`
	- `x-dead-letter-routing-key` (optional; nahi diya to original routing key)
- **Dead-lettered message ke headers:** `x-death` array — reason, original queue, count, time. Retry count nikalne me kaam aata hai.
```typescript
await ch.assertExchange("orders.dlx", "direct", { durable: true });
await ch.assertQueue("billing.dlq", { durable: true, arguments: { "x-queue-type": "quorum" } });
await ch.bindQueue("billing.dlq", "orders.dlx", "billing");

await ch.assertQueue("billing.queue", {
  durable: true,
  arguments: {
    "x-queue-type": "quorum",
    "x-dead-letter-exchange": "orders.dlx",
    "x-dead-letter-routing-key": "billing",
    "x-delivery-limit": 5, // 5 baar redeliver ke baad DLQ
  },
});
```
- **Retry with delay pattern (no plugin):**
	- Main queue fail → DLX → **retry queue** (with `x-message-ttl: 10000`, aur uska DLX wapas main exchange).
	- 10 sec baad message wapas main queue me aa jaata hai → **delayed retry**.
	- Exponential backoff: multiple retry queues (5s, 30s, 5m) ya `x-death` count se choose karo.
```mermaid
flowchart LR
    X["orders.events"] --> M["billing.queue"]
    M -->|"nack requeue=false"| D{{"orders.dlx"}}
    D --> R["billing.retry (TTL 10s)"]
    R -->|"TTL expired, DLX back"| X
    D -->|"retries exhausted"| Q["billing.dlq (manual review)"]
```
- **DLQ best practices:**
	- Har important queue ka apna DLQ.
	- DLQ **depth pe alert** lagao (messages_ready \> 0 for X min).
	- DLQ message me original headers + error reason store karo.
	- Replay tool/script rakho (shovel ya custom consumer jo wapas publish kare — **fix ke baad**).
- **Gotchas:**
	- Queue TTL ya message TTL expire hone par message **sirf queue ke head** se check hota hai (classic queues) — beech ke expired messages turant dead-letter nahi hote.
	- Quorum queues me **at-least-once dead-lettering** strategy available (`x-dead-letter-strategy`) — default at-most-once hai; reliability chahiye to configure karo.
	- DLX loop: DLQ ka DLX wapas same queue → infinite cycle. Cycle detection RabbitMQ karta hai but design se avoid karo.
	- **Poison message** bina DLX/limit ke = queue block (head-of-line).
---
## 9️⃣ Exchanges and Queues
<callout icon="💡" color="green_bg">
	**Ek line me:** **Exchange = sorting office** (chhaantta hai, rakhta nahi). **Queue = letterbox** (rakhti hai). Exchange ka **type** batata hai ki chhaantne ka tareeka kya hai.
</callout>
### 🧩 4 exchange types — kab kaunsa
<table fit-page-width="true" header-row="true">
<tr>
<td>Type</td>
<td>Kaise chhaantta hai</td>
<td>Example</td>
</tr>
<tr>
<td>**direct**</td>
<td>Routing key == binding key (exact)</td>
<td>`send_mail` → mail queue</td>
</tr>
<tr>
<td>**fanout**</td>
<td>Sab bound queues ko, key ignore</td>
<td>Broadcast / cache clear</td>
</tr>
<tr>
<td>**topic**</td>
<td>Pattern match (`*`, `#`)</td>
<td>`order.*`, `*.failed`</td>
</tr>
<tr>
<td>**headers**</td>
<td>Message headers match</td>
<td>Rare</td>
</tr>
</table>
```mermaid
flowchart TD
    A["Message ko kaise bhejna hai?"] --> B{"Sabko chahiye?"}
    B -->|"haan"| F["fanout"]
    B -->|"nahi"| C{"Exact label?"}
    C -->|"haan"| D["direct"]
    C -->|"pattern/group"| T["topic"]
```
### 🧩 Queue types (simple)
- **Classic** — purani, simple, fast.
- **Quorum** — replicated + safe, **important data ke liye default choice**.
- **Stream** — log jaisi, replay possible.
### 🧩 Queue ke 3 important flags
- `durable` → broker restart ke baad queue bachegi.
- `exclusive` → sirf ek connection use kare, band hote hi delete.
- `autoDelete` → last consumer jaate hi delete.
### 🧪 Khud check karo
<details>
<summary>Q. 3 services ko same event chahiye, kaunsa exchange?</summary>
	- **fanout** (sabko) ya **topic** (selective). Har service ki apni queue.
</details>
<details>
<summary>Q. Existing exchange ka type badalna ho to?</summary>
	- Delete karke dobara banao. In-place change nahi hota.
</details>
<details>
<summary>Q. Queue declare do baar alag properties se karo to?</summary>
	- `PRECONDITION_FAILED` error aur channel close.
</details>
### 📚 Deep dive
- **Exchange = router** (message store nahi karta). **Queue = buffer** (message store karta hai).
- **Exchange types:**
<table fit-page-width="true" header-row="true">
<tr>
<td>Type</td>
<td>Routing rule</td>
<td>Use case</td>
</tr>
<tr>
<td>**direct**</td>
<td>routing key == binding key (exact)</td>
<td>Task routing, log level</td>
</tr>
<tr>
<td>**fanout**</td>
<td>Sab bound queues ko (key ignore)</td>
<td>Broadcast, cache invalidation</td>
</tr>
<tr>
<td>**topic**</td>
<td>Pattern match (`*`, `#`)</td>
<td>Event bus, selective subscribe</td>
</tr>
<tr>
<td>**headers**</td>
<td>Header attributes match</td>
<td>Rare, multi-attribute routing</td>
</tr>
<tr>
<td>**default ("")**</td>
<td>routing key = queue name</td>
<td>Simple work queue</td>
</tr>
<tr>
<td>**consistent-hash** (plugin)</td>
<td>Hash of key → queue</td>
<td>Sharding / ordering per key</td>
</tr>
</table>
- **Exchange properties:** `durable`, `autoDelete`, `internal` (sirf exchange-to-exchange bindings), `alternateExchange`.
- **Exchange-to-exchange binding:** ek exchange doosre exchange se bind ho sakta hai → complex topologies (e.g. org-level exchange → team-level exchange).
- **Queue types (RabbitMQ 4.x):**
	- **Classic** — default purana, single-node, fast; **mirrored classic queues removed in 4.0**.
	- **Quorum** — **Raft-based replicated**, durable, safe — **production default recommendation** for important data.
	- **Stream** — append-only log, replay, high throughput (Kafka-jaisa).
- **Queue properties:**
	- `durable` — broker restart par queue definition survive kare.
	- `exclusive` — sirf declaring connection use kare, connection close = delete.
	- `autoDelete` — last consumer unsubscribe → delete.
	- Arguments: `x-message-ttl`, `x-expires`, `x-max-length`, `x-max-length-bytes`, `x-overflow`, `x-max-priority`, `x-dead-letter-exchange`, `x-queue-type`, `x-single-active-consumer`.
- **Declare = idempotent** (same properties se baar-baar declare safe); different properties → `PRECONDITION_FAILED`.
- **Topology kaun declare kare?** Best practice: consumer (queue owner) apni queue + binding declare kare; producer sirf exchange declare kare. Ya ek `topology.ts` module jo startup par run ho.
- **Naming convention:** `<service>.<purpose>` → `billing.order-events`; exchange → `<domain>.events`.
- **JS/Node analogy:** Exchange ≈ **router/dispatcher function**; Queue ≈ **array buffer** (FIFO) with persistence; Binding ≈ `emitter.on(pattern, queue.push)`.
- **Gotchas:**
	- Exchange change karna ho (type change) to **delete + recreate** — in-place alter nahi hota.
	- Auto-delete / exclusive queues quorum me allowed nahi.
	- Queue count bahut zyada (lakhs) → Erlang process + metadata overhead.
---
## 🔟 Message Persistence and Durability
<callout icon="💡" color="green_bg">
	**Ek line me:** Message tab hi restart se bachega jab **teeno** durable hon: **exchange + queue + message**. Ek bhi miss to message gaya.
</callout>
### 🧩 Teen locks — sab lagao
1. **Durable exchange:** `assertExchange(..., { durable: true })`
2. **Durable queue:** `assertQueue(..., { durable: true })`
3. **Persistent message:** `publish(..., { persistent: true })`
### 🧩 Restart ke baad kya bachta hai?
<table fit-page-width="true" header-row="true">
<tr>
<td>Setup</td>
<td>Queue</td>
<td>Message</td>
</tr>
<tr>
<td>Durable queue + persistent msg</td>
<td>✅</td>
<td>✅</td>
</tr>
<tr>
<td>Durable queue + transient msg</td>
<td>✅</td>
<td>❌</td>
</tr>
<tr>
<td>Non-durable queue</td>
<td>❌</td>
<td>❌</td>
</tr>
</table>
### 🧩 Ek aur step jo log bhool jaate hain
- Persistent flag lagane par bhi publish ke turant baad crash me message ja sakta hai (disk write async hota hai).
- **Publisher confirms** use karo: broker bolta hai "disk/replicas me safe hai".
```typescript
const ch = await conn.createConfirmChannel();
await ch.assertQueue("jobs", { durable: true });
ch.sendToQueue("jobs", Buffer.from("{}"), { persistent: true });
await ch.waitForConfirms(); // ab safe
```
- Production ke liye queue type **quorum** rakho (replicated).
### 🧪 Khud check karo
<details>
<summary>Q. Durable queue hai par message `persistent: false`. Restart par?</summary>
	- Queue bachegi, message nahi.
</details>
<details>
<summary>Q. `persistent: true` kaafi hai kya?</summary>
	- Nahi. Durable queue + publisher confirms bhi chahiye; quorum queue best.
</details>
<details>
<summary>Q. Docker me RabbitMQ ka data kaise bachaoge?</summary>
	- `/var/lib/rabbitmq` par volume mount.
</details>
### 📚 Deep dive
- **Teen cheezein durable honi chahiye** (teeno chahiye, ek bhi miss = loss):
	1. **Durable exchange** (`durable: true`)
	2. **Durable queue** (`durable: true`)
	3. **Persistent message** (`persistent: true` / `deliveryMode: 2`)
- **Persistent message ka matlab:** broker message ko **disk pe likhta hai** (restart ke baad bhi milega).
- **Lekin sirf persistent flag kaafi nahi:**
	- Disk write async/batched hota hai → publish ke turant baad crash par loss ho sakta hai → **publisher confirms** use karo (confirm tab aata hai jab disk/replicas me safe ho).
	- Quorum queue me confirm tab aata hai jab **majority replicas** ne fsync kar liya.
- **Transient message** (`persistent: false`) = memory-first, restart par gaya. Speed chahiye aur loss acceptable → use.
- **Classic queue v2:** messages mostly disk-backed, memory kam use hoti hai (purane "lazy queues" ka behaviour ab default jaisa).
- **Quorum queues:** har message replicate hota hai (default 3 nodes) → **node failure survive**. Disk + network cost zyada.
- **Durability vs Performance:**
	- Persistent + confirms + quorum = **safest, slower**
	- Transient + no confirms + classic = **fastest, lossy**
- **Consumer side durability:** manual ack after processing (topic 4).
- **Broker restart me kya bachta hai?**
	- Durable queue + persistent msg → ✅
	- Durable queue + transient msg → queue bachi, message ❌
	- Non-durable queue → queue + messages ❌
- **Docker volume** mount karna mat bhoolo (`/var/lib/rabbitmq`).
- **Backups:** definitions export (`rabbitmqctl export_definitions` / Management UI) — exchanges, queues, bindings, users, policies. Message data ka backup alag challenge hai → replicate (quorum) / shovel.
- **JS/Node analogy:** Persistent message ≈ DB me `INSERT` with `fsync`; transient ≈ in-memory `Map`. Publisher confirm ≈ `await db.insert()` ka resolve hona.
- **Gotchas:**
	- `assertQueue` bina `durable` ke default **durable: true** amqplib me hai, par message `persistent` explicit set karna padta hai — **dono alag cheez hain**.
	- Disk alarm (free space kam) → broker publishers ko **block** kar deta hai.
---
## 1️⃣1️⃣ Scalability & Load Balancing
<callout icon="💡" color="green_bg">
	**Ek line me:** Ek counter par line lambi ho gayi? **Aur counters kholo** (aur consumers chalao). Broker kaam ko unme baant deta hai.
</callout>
### 🧩 Scale karne ke 4 level (aasaan se mushkil)
1. **Zyada consumers:** same queue par N consumers → broker round-robin me baantta hai (**competing consumers**).
2. **Prefetch tune:** `prefetch(10)` — ek consumer ek saath kitne le. Chhota = fair, bada = fast.
3. **Queue shard:** ek queue ek leader tak limited hai; traffic ko kai queues me baanto (routing key / consistent-hash exchange).
4. **Cluster:** 3 nodes + quorum queues → ek node girne par bhi chalega.
```mermaid
flowchart LR
    Q["orders.queue (10k ready)"] --> C1["consumer 1"]
    Q --> C2["consumer 2"]
    Q --> C3["consumer 3"]
```
### 🧩 Trade-off: speed vs order
<table fit-page-width="true" header-row="true">
<tr>
<td>Setup</td>
<td>Speed</td>
<td>Order</td>
</tr>
<tr>
<td>1 consumer</td>
<td>Slow</td>
<td>✅ Preserved</td>
</tr>
<tr>
<td>Many consumers</td>
<td>Fast</td>
<td>❌ Guarantee nahi</td>
</tr>
<tr>
<td>Shard by key + 1 consumer per shard</td>
<td>Fast</td>
<td>✅ Per-key order</td>
</tr>
</table>
### 🧩 Kya dekhna hai (autoscale signal)
- `messages_ready` / consumers aur **message age**. CPU nahi.
- Node.js me CPU-heavy handler event loop block karega → connection drop; heavy kaam `worker_threads` me.
### 🧪 Khud check karo
<details>
<summary>Q. Queue bottleneck ban jaye to pehla fix?</summary>
	- Consumers badhao + prefetch tune. Phir bhi na ho to queue ko shard karo.
</details>
<details>
<summary>Q. Same orderId ke events ka order kaise bachaoge?</summary>
	- Key se shard karo (consistent-hash) aur har shard par ek consumer.
</details>
<details>
<summary>Q. Memory/disk alarm lagne par kya hota hai?</summary>
	- Broker publishers ko **block** kar deta hai (`connection.blocked`) taaki crash na ho.
</details>
### 📚 Deep dive
- **Competing consumers** = sabse simple horizontal scaling: same queue pe N consumer instances, broker **round-robin** se distribute karta hai.
- **Fair dispatch:** `prefetch(1)` ya small N — slow consumer ko zyada nahi milega (bina prefetch ke round-robin blind hota hai).
- **Scale kaise karein — levels:**
	- **Consumer level:** instances badhao (k8s HPA on `queue depth`), per-consumer prefetch tune karo, multiple channels.
	- **Queue level:** ek queue = ek core jaisa bottleneck (single Erlang process per queue) → traffic **multiple queues me shard** karo (consistent-hash exchange, ya routing key se partition).
	- **Node level:** cluster (3 ya 5 nodes odd number for quorum), queues alag nodes pe leader ke saath spread.
	- **Cross-DC:** **Federation** (loosely coupled, WAN) aur **Shovel** (message move karne ke liye).
- **Clustering basics:**
	- Nodes metadata share karte hain; **quorum queue** data replicate hota hai (leader + followers).
	- Client ko ek hi node pe hardcode mat karo → **TCP load balancer (HAProxy/NLB)** ya multiple host list.
	- **Network partition** → quorum queues majority side pe chalti hain (CP-ish); partition handling strategy configure karo (`pause_minority`).
- **Ordering vs parallelism trade-off:**
	- Ek consumer = order preserved. Multiple consumers = order **guarantee nahi**.
	- Per-key ordering chahiye (e.g. same `orderId`) → **consistent-hash exchange** ya **single-active-consumer** per shard queue.
- **Flow control / backpressure:**
	- Memory watermark (`vm_memory_high_watermark`, default 0.4) ya disk alarm → broker publishers ko **block** karta hai (`connection.blocked`).
	- Publisher side: confirms + bounded in-flight messages (window).
	- Consumer lag: `messages_ready` badh raha hai = consumers kam padh rahe hain.
- **Autoscaling signal:** `messages_ready / consumers` ya message age; CPU nahi.
- **Connection hygiene:** per-process 1 connection, limited channels. Connection-per-request = **anti-pattern** (TCP + auth handshake costly).
- **Node.js specifics:**
	- Node single-threaded → CPU-heavy handler event loop block karega → heartbeat miss → broker connection drop. CPU kaam **worker_threads** ya alag process me.
	- Multiple Node processes (cluster/PM2/k8s pods) = natural competing consumers.
```mermaid
flowchart LR
    Q["orders.queue (ready: 10k)"] --> C1["consumer pod 1 (prefetch 10)"]
    Q --> C2["consumer pod 2 (prefetch 10)"]
    Q --> C3["consumer pod 3 (prefetch 10)"]
    H["HPA: scale on messages_ready per consumer"] -.-> Q
```
- **Gotchas:**
	- Prefetch badhane se throughput badhta hai par **ordering + fairness + memory** kharab ho sakti hai.
	- Quorum queue ki write throughput single-queue leader tak limited → shard.
	- Bohot saare consumers on tiny queue = wasted connections.
---
## 1️⃣2️⃣ Specialized Queues and Patterns
<callout icon="💡" color="green_bg">
	**Ek line me:** Patterns = **ready-made recipes**. Problem pehchano, recipe chuno.
</callout>
### 🧩 Problem → Pattern (ek hi table me)
<table fit-page-width="true" header-row="true">
<tr>
<td>Problem</td>
<td>Pattern</td>
<td>Ek line me</td>
</tr>
<tr>
<td>Background kaam (email, PDF)</td>
<td>**Work queue**</td>
<td>Ek queue, many workers, manual ack</td>
</tr>
<tr>
<td>Fail hone par thodi der baad retry</td>
<td>**Retry queue (TTL + DLX)**</td>
<td>Fail → retry queue → TTL ke baad wapas</td>
</tr>
<tr>
<td>Reply chahiye</td>
<td>**RPC**</td>
<td>`replyTo`  • `correlationId` (kam use karo)</td>
</tr>
<tr>
<td>Urgent jobs pehle</td>
<td>**Priority queue**</td>
<td>`x-max-priority` (1–5 hi rakho)</td>
</tr>
<tr>
<td>Strict order + failover</td>
<td>**Single active consumer**</td>
<td>Ek active, baaki standby</td>
</tr>
<tr>
<td>Replay / audit</td>
<td>**Stream**</td>
<td>Log jaisi, offset se dobara padho</td>
</tr>
<tr>
<td>DB aur broker dono consistent</td>
<td>**Outbox pattern**</td>
<td>DB me order + outbox row, relay publish karta hai</td>
</tr>
<tr>
<td>Duplicate delivery safe</td>
<td>**Idempotent consumer**</td>
<td>`messageId` unique key</td>
</tr>
</table>
### 🧩 Do patterns jo sabse zyada puchhe jaate hain (simple)
- **Outbox kyun?** DB commit ho gaya par publish fail → data inconsistent. Isliye order aur outbox row **ek hi DB transaction** me likho; alag process outbox se publish kare.
- **Idempotent consumer kyun?** At-least-once me duplicate aate hain. `messageId` ko DB me unique rakho; dobara aaya to skip.
### 🧪 Khud check karo
<details>
<summary>Q. Retry 30 sec baad chahiye, kaise?</summary>
	- Retry queue with `x-message-ttl: 30000` aur DLX wapas main exchange.
</details>
<details>
<summary>Q. Outbox pattern kis problem ko solve karta hai?</summary>
	- Dual-write problem: DB aur broker ek saath atomic nahi hote.
</details>
<details>
<summary>Q. RPC queue par kab avoid karoge?</summary>
	- Latency-sensitive sync flows me (HTTP/gRPC better). Timeouts aur coupling complex.
</details>
### 📚 Deep dive
- **1. Work Queue (Task Queue):** ek queue, many workers, manual ack, `prefetch`. Email send, image resize, report generate.
- **2. RPC (Request/Reply):**
	- Client request queue me bhejta hai with `replyTo` + `correlationId`.
	- Server reply `replyTo` queue pe bhejta hai (same `correlationId`).
	- **Direct reply-to** (`amq.rabbitmq.reply-to`) — temporary reply queue banane ki zarurat nahi.
	- Warning: RPC over queue = **coupling + timeout complexity** → mostly sync HTTP/gRPC better; use sparingly.
- **3. Priority Queue:**
	- `x-max-priority: 5` (chhota rakho, 1–5; zyada = CPU cost).
	- Publish me `priority: 0..N`. Higher priority pehle deliver hota hai (consumers fast ho to effect kam dikhta hai mtlb ki sort hone ka time nhi mil pata priority vise).
	- Starvation risk: low-priority kabhi process na ho.
- **4. Delayed Messages:**
	- Option A: **TTL + DLX** retry queue (plugin-free; per-queue TTL).
	- Option B: **rabbitmq-delayed-message-exchange** plugin (per-message delay, `x-delay` header) — limits hain (scale, durability).
- **5. TTL queues:** message `expiration` (per-message) ya `x-message-ttl` (per-queue); expired → DLX.
- **6. Single Active Consumer (****`x-single-active-consumer: true`****):**
	- Queue pe multiple consumers connected, par **sirf ek active** — baaki standby. Active mar jaye to next uthata hai.
	- Strict ordering + HA failover ke liye.
- **7. Exclusive / Temporary queues:** per-connection private queues (RPC replies, live dashboards).
- **8. Streams:**
	- Append-only log, **non-destructive read**, offset-based replay, multiple consumers independent.
	- Use: audit log, large fan-out, re-processing. Node client: `rabbitmq-stream-js-client`.
- **9. Poison-message / Retry-limit pattern:** `x-delivery-limit` (quorum) ya `x-death` count.
- **10. Outbox pattern (important):** DB transaction me business row + `outbox` row likho → alag relay process outbox se RabbitMQ me publish karta hai → **dual-write problem** solve (DB commit hua par publish fail, ya ulta).
- **11. Idempotent Consumer:** `messageId` DB me unique key / Redis `SET NX` → duplicate delivery harmless.
- **12. Saga / Choreography:** services events publish karke workflow chalati hain (`order.created` → `payment.completed` → `inventory.reserved`), failure par compensating events.
- **13. Request throttling / rate limit:** `prefetch` + consumer-side limiter (e.g. `bottleneck`) third-party API limits ke liye.
```typescript
// RPC client (direct reply-to) — short example
import { randomUUID } from "node:crypto";

async function rpcCall(ch: any, queue: string, payload: unknown): Promise<unknown> {
  const correlationId = randomUUID();
  return new Promise(async (resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("RPC timeout")), 5000);
    await ch.consume(
      "amq.rabbitmq.reply-to",
      (msg: any) => {
        if (msg?.properties.correlationId !== correlationId) return;
        clearTimeout(timer);
        resolve(JSON.parse(msg.content.toString()));
      },
      { noAck: true } // direct reply-to ke liye noAck true zaroori
    );
    ch.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
      correlationId,
      replyTo: "amq.rabbitmq.reply-to",
    });
  });
}
```
- **Pattern chuno kab?**
<table fit-page-width="true" header-row="true">
<tr>
<td>Need</td>
<td>Pattern</td>
</tr>
<tr>
<td>Background jobs</td>
<td>Work queue + DLQ</td>
</tr>
<tr>
<td>Many services react to event</td>
<td>Topic exchange + per-service queue</td>
</tr>
<tr>
<td>Retry after delay</td>
<td>Retry queue (TTL + DLX)</td>
</tr>
<tr>
<td>Strict order + failover</td>
<td>Single active consumer / consistent-hash shards</td>
</tr>
<tr>
<td>Replay / audit</td>
<td>Stream</td>
</tr>
<tr>
<td>DB + broker consistency</td>
<td>Outbox + idempotent consumer</td>
</tr>
</table>
---
## 🚨 Production Concerns & Failure Modes
- **High load me kya toot-ta hai?**
	- **Queue backlog** badhta hai → memory/disk alarm → publishers **blocked** → upstream API timeout → p99 latency spike.
	- **Unacked pile-up:** prefetch bada + slow handler → RAM me messages stuck, redelivery storm after crash.
	- **Connection/channel leak:** har request pe naya channel kholna → `channel_max` / FD limit hit.
	- **Poison message loop:** `nack(requeue=true)` bina limit → CPU 100%, queue head block.
	- **Large messages:** MB-level payloads → memory + network pressure. **Claim-check pattern:** payload S3/DB me, message me sirf ID.
	- **Event loop block (Node):** heavy sync code → heartbeat timeout → connection drop → unacked redelivery.
	- **Network partition / node loss:** classic queues me data loss risk; quorum queues use karo, 3+ odd nodes.
- **Backpressure se server kaise bachta hai?**
	- `prefetch` consumer ko overwhelm hone se rokta hai.
	- Publisher confirms + `drain` + bounded in-flight = producer slow hota hai jab broker slow.
	- Broker `connection.blocked` (memory/disk alarm) = last line of defence.
	- Queue limits (`x-max-length` + overflow `reject-publish`) = explicit load shedding.
- **Duplicate + ordering:**
	- At-least-once ⇒ duplicates hamesha possible → idempotency key.
	- Requeue / multiple consumers ⇒ order break → per-key sharding.
- **Security risks:**
	- `guest` user disable, per-service user + **vhost** + minimum permissions (configure/write/read regex).
	- **TLS (amqps)** production me, Management UI ko public mat karo.
	- Message payload me **PII** → encrypt/mask; DLQ me bhi PII sit karta hai (retention policy).
	- Untrusted payload → **schema validate (zod)** before processing; deserialization attacks se bacho.
- **Observability:**
	- Metrics: `messages_ready`, `messages_unacked`, publish/deliver rate, consumer count, **message age**, connection blocked, DLQ depth.
	- Prometheus plugin (`rabbitmq_prometheus`) + Grafana; alerts: DLQ \> 0, consumers == 0, queue age \> SLA.
- **Cost/Capacity:** quorum queues = 3x disk/network; retained backlog = disk usage; Streams retention policy set karo.
---
## 🧪 Runnable TypeScript Scaffold — Order Events via Pub/Sub
- **Folder structure:**
```plain text
rabbit-orders/
├── package.json
├── tsconfig.json
└── src/
    ├── config.ts
    ├── topology.ts      # exchanges + queues + bindings + DLX
    ├── publisher.ts     # order-service: publish order events (confirms)
    ├── consumer.ts      # generic consumer: ack/nack/idempotency/shutdown
    └── run-consumers.ts # billing + email + analytics consumers
```
- **package.json:**
```json
{
  "name": "rabbit-orders",
  "private": true,
  "type": "module",
  "scripts": {
    "topology": "tsx src/topology.ts",
    "consumers": "tsx src/run-consumers.ts",
    "publish": "tsx src/publisher.ts"
  },
  "dependencies": { "amqplib": "^0.10.4" },
  "devDependencies": {
    "@types/amqplib": "^0.10.5",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```
- **src/config.ts:**
```typescript
export const AMQP_URL = process.env.AMQP_URL ?? "amqp://app:app@localhost:5672";

export const EXCHANGES = {
  events: "orders.events", // topic
  dlx: "orders.dlx", // direct
  unrouted: "orders.unrouted", // alternate exchange (fanout)
} as const;

export const QUEUES = {
  billing: "billing.order-events",
  email: "email.order-events",
  analytics: "analytics.order-events",
  billingDlq: "billing.order-events.dlq",
  unrouted: "orders.unrouted.queue",
} as const;
```
- **src/topology.ts:**
```typescript
import amqp from "amqplib";
import { AMQP_URL, EXCHANGES, QUEUES } from "./config.js";

export type Channel = Awaited<
  ReturnType<Awaited<ReturnType<typeof amqp.connect>>["createChannel"]>
>;

export async function setupTopology(ch: Channel): Promise<void> {
  // exchanges
  await ch.assertExchange(EXCHANGES.unrouted, "fanout", { durable: true });
  await ch.assertExchange(EXCHANGES.dlx, "direct", { durable: true });
  await ch.assertExchange(EXCHANGES.events, "topic", {
    durable: true,
    alternateExchange: EXCHANGES.unrouted,
  });

  // safety-net queues
  await ch.assertQueue(QUEUES.unrouted, { durable: true });
  await ch.bindQueue(QUEUES.unrouted, EXCHANGES.unrouted, "");

  await ch.assertQueue(QUEUES.billingDlq, {
    durable: true,
    arguments: { "x-queue-type": "quorum" },
  });
  await ch.bindQueue(QUEUES.billingDlq, EXCHANGES.dlx, "billing");

  // subscribers (ek queue per service = pub/sub)
  await ch.assertQueue(QUEUES.billing, {
    durable: true,
    arguments: {
      "x-queue-type": "quorum",
      "x-dead-letter-exchange": EXCHANGES.dlx,
      "x-dead-letter-routing-key": "billing",
      "x-delivery-limit": 5,
    },
  });
  await ch.bindQueue(QUEUES.billing, EXCHANGES.events, "order.created");
  await ch.bindQueue(QUEUES.billing, EXCHANGES.events, "order.cancelled");

  await ch.assertQueue(QUEUES.email, {
    durable: true,
    arguments: { "x-queue-type": "quorum" },
  });
  await ch.bindQueue(QUEUES.email, EXCHANGES.events, "order.*");

  await ch.assertQueue(QUEUES.analytics, {
    durable: true,
    arguments: { "x-queue-type": "quorum" },
  });
  await ch.bindQueue(QUEUES.analytics, EXCHANGES.events, "#");
}

// `npm run topology` se direct run
if (import.meta.url === `file://${process.argv[1]}`) {
  const conn = await amqp.connect(AMQP_URL);
  const ch = await conn.createChannel();
  await setupTopology(ch);
  console.log("topology ready");
  await ch.close();
  await conn.close();
}
```
- **src/publisher.ts:**
```typescript
import amqp from "amqplib";
import { randomUUID } from "node:crypto";
import { AMQP_URL, EXCHANGES } from "./config.js";
import { setupTopology } from "./topology.js";

const conn = await amqp.connect(AMQP_URL);
const ch = await conn.createConfirmChannel(); // publisher confirms ON
await setupTopology(ch);

// unroutable message wapas aaye to log karo (mandatory + return)
ch.on("return", (msg) => {
  console.error("UNROUTABLE:", msg.fields.routingKey);
});

function publishEvent(routingKey: string, payload: object): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = ch.publish(
      EXCHANGES.events,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      {
        persistent: true,
        mandatory: true,
        contentType: "application/json",
        messageId: randomUUID(), // consumer idempotency key
        timestamp: Date.now(),
        type: routingKey,
      },
      (err) => (err ? reject(err) : resolve()) // broker confirm callback
    );
    if (!ok) console.warn("publish buffer full — drain ka wait karna chahiye");
  });
}

await publishEvent("order.created", { orderId: "o-1001", amount: 499 });
await publishEvent("order.cancelled", { orderId: "o-1002" });
await publishEvent("order.shipped.in", { orderId: "o-1003" }); // order.* match nahi karega, analytics (#) karega

await ch.waitForConfirms();
console.log("published + confirmed");
await ch.close();
await conn.close();
```
- **src/consumer.ts:**
```typescript
import amqp from "amqplib";
import { AMQP_URL } from "./config.js";
import { setupTopology } from "./topology.js";

type Handler = (body: unknown, messageId: string) => Promise<void>;

// demo ke liye in-memory; production me Redis SET NX ya DB unique constraint
const processed = new Set<string>();

export async function startConsumer(queue: string, handler: Handler, prefetch = 10) {
  const conn = await amqp.connect(AMQP_URL);
  const ch = await conn.createChannel();
  await setupTopology(ch);
  await ch.prefetch(prefetch);

  conn.on("error", (e) => console.error("conn error", e.message));
  conn.on("close", () => {
    console.error("connection closed — restart / reconnect with backoff");
    process.exit(1); // k8s pod restart karega
  });

  const inFlight = new Set<Promise<void>>();

  const { consumerTag } = await ch.consume(
    queue,
    (msg) => {
      if (!msg) return;
      const task = (async () => {
        const messageId = msg.properties.messageId as string;
        try {
          if (processed.has(messageId)) {
            ch.ack(msg); // duplicate — chupchap ack
            return;
          }
          const body = JSON.parse(msg.content.toString());
          await handler(body, messageId);
          processed.add(messageId);
          ch.ack(msg); // business logic ke BAAD ack
        } catch (err) {
          console.error(`[${queue}] failed`, (err as Error).message);
          // pehli baar fail → requeue; redelivered ho chuka → DLX
          const requeue = !msg.fields.redelivered;
          ch.nack(msg, false, requeue);
        }
      })();
      inFlight.add(task);
      task.finally(() => inFlight.delete(task));
    },
    { noAck: false }
  );

  // graceful shutdown: naya message lena band, in-flight khatam hone do
  const shutdown = async () => {
    await ch.cancel(consumerTag);
    await Promise.allSettled([...inFlight]);
    await ch.close();
    await conn.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
```
- **src/run-consumers.ts:**
```typescript
import { QUEUES } from "./config.js";
import { startConsumer } from "./consumer.js";

await startConsumer(QUEUES.billing, async (body, id) => {
  console.log("[billing]", id, body);
  if ((body as { orderId?: string }).orderId === "o-1002") {
    throw new Error("simulated billing failure"); // DLQ flow test karne ke liye
  }
});

await startConsumer(QUEUES.email, async (body, id) => {
  console.log("[email]", id, body);
});

await startConsumer(QUEUES.analytics, async (body, id) => {
  console.log("[analytics]", id, body);
});
```
- **Run karne ka order:**
	- `docker compose up -d` → `npm run topology` → `npm run consumers` (terminal 1) → `npm run publish` (terminal 2)
	- Management UI me check: `billing.order-events.dlq` me `o-1002` aana chahiye, `orders.unrouted.queue` empty rahegi (sab key kisi na kisi binding se match hui).
- **Experiments (samajh pakki karne ke liye):**
	- Consumer ko `ack` se pehle `process.exit()` karwao → message redeliver hota dikhega (`redelivered: true`).
	- `email` queue ki binding hata ke `order.shipped.in` publish karo → kaun si queue ko mila dekho.
	- Ek aur consumer instance `billing` queue pe chalao → competing consumers (round-robin).
	- Publisher me `mandatory: true` rakh ke aisa routing key bhejo jo kisi binding se match na kare (AE disable karke) → `return` event.
---
## 🎤 Interview Q&A
### Part A — Basics (What / Install / Publish-Consume / AMQP-MQTT)
<details>
<summary>Q1. RabbitMQ aur Kafka me kya fark hai? Kab kya choose karoge?</summary>
	- RabbitMQ = **smart broker**, queue semantics, per-message ack, flexible routing (exchanges), message consume ke baad delete.
	- Kafka = **distributed log**, partitions, consumer offsets, replay, bahut high throughput.
	- RabbitMQ choose karo: task queues, complex routing, low latency, per-message retry/DLQ.
	- Kafka choose karo: event streaming, replay, analytics pipeline, millions msgs/sec.
	- Note: RabbitMQ Streams ab replay deta hai, to line blurred hai — par ecosystem alag hai.
</details>
<details>
<summary>Q2. Connection aur Channel me kya difference hai? Kyun?</summary>
	- Connection = TCP (+TLS + auth) — costly, long-lived.
	- Channel = connection ke andar lightweight virtual connection (multiplexed).
	- Process me 1 connection, multiple channels (publish aur consume ke liye alag channel recommended — backpressure ek doosre ko block na kare).
	- Anti-pattern: har request pe connection kholna.
</details>
<details>
<summary>Q3. Default exchange kya hota hai? `sendToQueue` actually kya karta hai?</summary>
	- Default exchange nameless **direct** exchange hai; har queue automatically apne naam ke binding key se bound.
	- `sendToQueue(q, msg)` = default exchange pe routing key `q` se publish.
	- Isse lagta hai producer queue me directly bhej raha hai, par routing abhi bhi exchange se hi ho rahi hai.
</details>
<details>
<summary>Q4. Publish karne ke baad ye kaise pata chalega ki broker ne message accept kar liya?</summary>
	- **Publisher confirms** (`createConfirmChannel`) — broker ack deta hai jab message route + persist (quorum me majority) ho gaya.
	- Plus `mandatory` flag + `return` handler unroutable messages ke liye.
	- AMQP transactions (`tx.select`) slow hain, confirms prefer karo.
</details>
<details>
<summary>Q5. AMQP vs MQTT? RabbitMQ dono kaise support karta hai?</summary>
	- AMQP: server-side reliable messaging, rich routing. MQTT: IoT, lightweight, topic-only, QoS 0/1/2.
	- `rabbitmq_mqtt` plugin MQTT topics ko routing keys me map karta hai (`/` → `.`) via `amq.topic` exchange.
	- Isse IoT devices (MQTT) aur backend services (AMQP) ek hi broker pe interoperate karte hain.
</details>
### Part B — Routing (Pub/Sub / Topics / Exchanges & Queues)
<details>
<summary>Q6. Work queue aur pub/sub me fark? RabbitMQ me pub/sub kaise implement hota hai?</summary>
	- Work queue: ek queue, many consumers, har message ek consumer ko (load distribution).
	- Pub/sub: har subscriber ki **apni queue**, sab same exchange se bound, har ko copy.
	- Implement: fanout ya topic exchange + per-service durable queue.
	- Common bug: do services ek hi queue share karti hain → pub/sub nahi, competing consumers.
</details>
<details>
<summary>Q7. `*` aur `#` me kya fark? `order.*` kya match karega?</summary>
	- `*` exactly ek word, `#` zero ya zyada words.
	- `order.*` → `order.created` ✅, `order.created.in` ❌, `order` ❌.
	- `order.#` → teeno variants including `order` ✅.
	- `#` alone = fanout behaviour, wildcard-less = direct behaviour.
</details>
<details>
<summary>Q8. Chaaron exchange types kab use karoge?</summary>
	- direct: exact key (task routing). fanout: broadcast. topic: selective event subscription. headers: multi-attribute match (rare).
	- Extra: consistent-hash plugin sharding ke liye, alternate exchange unroutable ke liye.
	- Production me mostly **topic exchange** event bus ke liye.
</details>
<details>
<summary>Q9. Message kisi queue me route nahi hua to kya hota hai? Kaise handle karoge?</summary>
	- Default: **silently dropped**.
	- Fix: `mandatory: true` + `return` listener, ya **alternate exchange** jo unroutable messages ek queue me store kare.
	- Monitoring: unroutable metric alert.
</details>
<details>
<summary>Q10. Queue types — classic, quorum, stream me kya choose karoge?</summary>
	- Classic: simple, fast, single-node; mirrored version 4.0 me removed.
	- Quorum: Raft replicated, safe — **production default** for critical data.
	- Stream: append-only log, replay, high fan-out.
	- Quorum limitations: exclusive/auto-delete nahi, priority limited, zyada disk/network.
</details>
### Part C — Reliability (Ack / DLX / Persistence)
<details>
<summary>Q11. Auto-ack aur manual ack me kya difference? Kab kya?</summary>
	- Auto-ack: deliver hote hi message delete → consumer crash par loss. Sirf non-critical/telemetry.
	- Manual ack: process ke baad ack → crash par redeliver (at-least-once).
	- Manual ack ke saath duplicates possible → idempotent consumer zaroori.
</details>
<details>
<summary>Q12. Prefetch kya hai aur kaise tune karoge?</summary>
	- Max unacked messages jo broker ek consumer (ya channel) ko push kar sakta hai.
	- Chhota (1–10): fair dispatch, kam memory; bada: throughput zyada, par fairness aur ordering risk.
	- Tune: handler latency + network RTT dekh ke; I/O-bound me 10–50, CPU-bound me 1–2.
	- Metric: `messages_unacked` aur consumer utilisation.
</details>
<details>
<summary>Q13. Poison message kya hai aur kaise handle karoge?</summary>
	- Aisa message jo har baar processing fail karta hai; `nack(requeue=true)` loop me queue block + CPU burn.
	- Fix: retry limit (`x-delivery-limit` / `x-death` count), phir DLX → DLQ.
	- Plus: schema validation, alert on DLQ depth, replay tool fix ke baad.
</details>
<details>
<summary>Q14. Message loss zero kaise karoge? End-to-end guarantee batao.</summary>
	- Producer: publisher confirms (+ outbox pattern DB consistency ke liye).
	- Broker: durable exchange/queue + persistent messages + quorum queue.
	- Consumer: manual ack after commit + idempotency.
	- Result: at-least-once. **Exactly-once practically nahi** — effectively-once via idempotency.
</details>
<details>
<summary>Q15. Delayed retry with exponential backoff RabbitMQ me kaise karoge?</summary>
	- TTL + DLX pattern: fail → retry queue (TTL 5s/30s/5m) → TTL expire hone par DLX se main exchange pe wapas.
	- Retry count `x-death` header se; limit cross → DLQ.
	- Alternative: delayed-message-exchange plugin (per-message delay) — scale limits ka dhyan.
</details>
### Part D — Scale & Patterns
<details>
<summary>Q16. Consumers scale kaise karoge aur ordering ka kya hoga?</summary>
	- Competing consumers + prefetch; autoscale on queue depth/message age.
	- Multiple consumers = global order guarantee nahi.
	- Per-key order: consistent-hash exchange se shard queues + har shard pe single consumer / single-active-consumer.
</details>
<details>
<summary>Q17. Ek queue bottleneck ban jaaye to? Throughput kaise badhaoge?</summary>
	- Ek queue ek leader/process tak bound hota hai → **queue sharding** (consistent-hash/routing key partition).
	- Consumers badhao, prefetch tune, batch ack (`multiple=true`), publisher side batching + confirms.
	- Bohot high volume + replay chahiye → Streams.
</details>
<details>
<summary>Q18. Broker memory/disk alarm trigger ho jaye to kya hota hai?</summary>
	- Broker publishing connections ko block karta hai (`connection.blocked`) taaki crash na ho.
	- Producer side timeouts, upstream latency spike.
	- Fix: consumers scale, backlog drain, queue max-length/TTL policies, alarms pe alert pehle se.
</details>
<details>
<summary>Q19. Outbox pattern kyun chahiye? Dual-write problem kya hai?</summary>
	- DB commit aur broker publish do alag systems hain — ek fail hua to inconsistent state.
	- Outbox: business row + outbox row same DB transaction me; relay process outbox se publish karke mark-sent.
	- Delivery at-least-once → consumers idempotent.
</details>
<details>
<summary>Q20. RabbitMQ me RPC pattern kaise kaam karta hai? Kab avoid karoge?</summary>
	- `replyTo` + `correlationId`; direct reply-to (`amq.rabbitmq.reply-to`) se temp queue overhead nahi.
	- Avoid: latency-sensitive sync flows (HTTP/gRPC better), timeouts/retries complex, hidden coupling.
	- Use: legacy integration, long-ish ops jahan queue buffering helpful.
</details>
---
## ✅ Quick Revision Checklist
- [ ] RabbitMQ = broker; flow: Producer → Exchange → Binding → Queue → Consumer
- [ ] Docker se `rabbitmq:4-management` chalaya, ports 5672 / 15672 / 1883 yaad hain
- [ ] `guest` user production me nahi; vhost + least privilege
- [ ] Default exchange = routing key queue name
- [ ] Publisher confirms + `mandatory` + alternate exchange samajh aaya
- [ ] Manual ack **business logic ke baad**; ack / nack / reject difference clear
- [ ] Prefetch ka role (fair dispatch + memory) clear
- [ ] At-least-once = confirms + durable + persistent + manual ack; idempotent consumer zaroori
- [ ] AMQP 0-9-1 vs MQTT; MQTT topic `/` → AMQP key `.` via `amq.topic`
- [ ] Pub/Sub = per-service queue; same queue share = competing consumers
- [ ] Topic wildcards: `*` = 1 word, `#` = 0+ words
- [ ] Routing key (producer, address) vs Binding key (queue, pattern) ka difference; wildcard sirf binding me
- [ ] Topic exchange ke 3 steps: publish → bindings match → har matching queue ko 1 copy
- [ ] 4 exchange types + consistent-hash + alternate exchange
- [ ] Queue types: classic vs quorum vs stream
- [ ] DLX triggers: nack(requeue=false), TTL, max-length, delivery-limit
- [ ] Retry queue (TTL + DLX) + DLQ monitoring + replay plan
- [ ] Durable exchange + durable queue + persistent message — teeno
- [ ] Scaling: competing consumers, queue sharding, quorum cluster, autoscale on queue depth
- [ ] Patterns: work queue, RPC, priority, delayed, single-active-consumer, stream, outbox, idempotent consumer
- [ ] Scaffold run kiya: topology → consumers → publish; DLQ me `o-1002` verify kiya