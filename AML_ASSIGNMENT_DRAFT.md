# VoltShare AML Assignment Draft

## Working Title

**VoltShare: Weather-Aware Machine Learning for Household Solar Listing Price Recommendation**

## 1. Project Overview

This project studies how machine learning can support pricing decisions in peer-to-peer solar electricity trading.  
The central idea is that a household seller with rooftop solar often has surplus electricity, but does not know the best time or price to list that electricity in the market.

The project combines three sources of information:

- historical buyer-side electricity demand data for the VIC1 region
- hourly aggregated solar supply data derived from solar generation records
- historical weather data aligned by hour using Open-Meteo

The final goal is not only to predict demand, but to turn those predictions into a practical **price recommendation** for a seller.

## 2. Problem Statement

The problem addressed in this project is:

**Given a future listing hour, a household's expected surplus electricity, recent market history, and weather conditions, what listing price is likely to produce the best expected return?**

This is an applied machine learning problem because the relationship between:

- time of day
- demand conditions
- solar supply availability
- weather conditions
- and acceptable buyer prices

is too complex to model with fixed manual rules alone.

## 3. Datasets

### 3.1 VIC1 Demand Data

The first dataset is a VIC1 electricity demand and price dataset.  
It contains market-side information that was aggregated to the hourly level and transformed into buyer-side demand bid proxies.

Important fields used in the project:

- hourly timestamp
- total demand
- derived willingness-to-pay proxy

In the current processed dataset:

- the data is stored in [`src/data/vic1DemandBids.ts`](/Users/sherly/Downloads/dashboard/src/data/vic1DemandBids.ts:1)
- the original CSV source is [`src/data/price_and_demand_vic1.csv`](/Users/sherly/Downloads/dashboard/src/data/price_and_demand_vic1.csv:1)

### 3.2 Solar Supply Data

The second dataset is historical solar generation data that was aggregated into hourly supply-side surplus signals.

The processing logic assumes that positive quarter-hour solar generation observations can be aggregated into hour-level supply, and then scaled to represent a typical household-level surplus signal.

In the current processed dataset:

- the data is stored in [`src/data/solarSupplyReports.ts`](/Users/sherly/Downloads/dashboard/src/data/solarSupplyReports.ts:1)
- the raw CSV source is [`src/data/Solar_Energy_Generation.csv`](/Users/sherly/Downloads/dashboard/src/data/Solar_Energy_Generation.csv:1)

### 3.3 Historical Weather Data

The third dataset is hourly historical weather data from Open-Meteo, aligned to the same hourly timestamps used in the demand and supply datasets.

Weather is important because it directly affects solar generation and indirectly affects electricity demand patterns.

The aligned weather features include:

- temperature
- cloud cover
- precipitation
- shortwave radiation
- direct normal irradiance
- day/night indicator

The weather alignment logic is implemented in [`src/services/weatherService.ts`](/Users/sherly/Downloads/dashboard/src/services/weatherService.ts:1).

## 4. Machine Learning Objective

The machine learning objective in this project is best described as a two-stage system:

### Stage 1: Demand Modeling

Estimate buyer-side demand under a given market context and candidate listing price.

### Stage 2: Price Optimization

Use the predicted demand together with supply-side context to search over candidate prices and select the listing price with the highest expected net benefit.

So the project is not only a pure prediction task.  
It is a **prediction plus optimization** task.

## 5. Feature Engineering

The project uses several categories of features.

### 5.1 Time Features

- hour of day
- month
- day of week
- weekend indicator
- cyclical encodings using sine and cosine transforms

### 5.2 Lag Features

- lag demand at 1 hour
- lag demand at 24 hours
- lag price at 1 hour
- lag price at 24 hours
- rolling 24-hour demand mean
- rolling 24-hour price mean

### 5.3 Weather Features

- temperature
- cloud cover
- precipitation
- shortwave radiation
- direct normal irradiance
- day/night indicator

These features are built and used in the demand modeling pipeline implemented in [`src/services/aiService.ts`](/Users/sherly/Downloads/dashboard/src/services/aiService.ts:1).

## 6. Models Used

### 6.1 Baseline Model: OLS

An Ordinary Least Squares regression model is used as a baseline model.  
This gives an interpretable linear benchmark and helps evaluate whether more flexible models provide better predictive performance.

### 6.2 Random Forest

A Random Forest model is used as the more flexible nonlinear model.  
This model is better able to capture interactions between time, demand history, and weather variables.

### 6.3 Price Search Layer

After demand has been estimated, the system performs grid search across candidate listing prices.  
Each price is evaluated using the predicted demand response and supply-side constraints, and the best price is selected as the final recommendation.

## 7. Training and Evaluation Strategy

Because this is time-series-like market data, random train-test shuffling is not appropriate.  
The project instead uses a **forward-chaining style split**, where earlier data is used for training and later data is used for validation and testing.

This choice is important because it better reflects how the model would be used in practice: predicting future market behavior from past observations.

The main evaluation metrics are:

- RMSE
- MAE
- R²

These metrics are tracked for both the OLS baseline and the Random Forest model.

### 7.1 Current Split Sizes

Using the current hourly VIC1 demand dataset, the pipeline produced:

- Training rows: `7,644`
- Validation rows: `1,092`
- Test rows: `2,185`

This means the models were evaluated on a sizeable out-of-sample test window rather than only on the training period.

## 8. Current Results

The current notebook pipeline produced the following test-set results:

| Model | RMSE | MAE | R² |
| --- | --- | --- | --- |
| OLS baseline | 0.3405 | 0.2211 | 0.8990 |
| Random Forest | 0.2892 | 0.1798 | 0.9272 |

### 8.1 Result Interpretation

These results show that the Random Forest model outperformed the OLS baseline on all three evaluation metrics.

- Its RMSE decreased from `0.3405` to `0.2892`
- Its MAE decreased from `0.2211` to `0.1798`
- Its R² increased from `0.8990` to `0.9272`

This suggests that the relationship between demand, price, and temporal context is not fully linear, and that the nonlinear Random Forest model captures additional useful structure in the data.

In practical terms, this makes the Random Forest a stronger candidate for the downstream pricing recommendation stage.

## 9. Current System Output

The system outputs:

- an optimized listing price
- expected net revenue
- estimated demand coverage
- expected shortfall
- weather-adjusted demand and supply explanation

This makes the final output useful for decision support rather than only academic prediction.

### 9.1 Example of Decision-Support Output

For a demonstration listing scenario, the system can take:

- a seller's expected surplus electricity
- a chosen listing hour
- a candidate target price

and return:

- an optimized listing price
- expected net revenue
- estimated demand coverage
- weather-adjusted supply and demand explanation

This is the main reason the project goes beyond a pure prediction exercise: the ML output is converted into an actionable recommendation.

## 10. Why This Is an AML Project

This project fits AML well because it includes the full workflow of an applied machine learning system:

- real-world problem framing
- multi-source data processing
- feature engineering
- baseline and nonlinear model comparison
- time-aware evaluation
- decision support output
- user-facing dashboard demonstration

In other words, the project does not stop at model fitting.  
It carries the ML results into a realistic product-style decision tool.

## 11. Limitations

There are several important limitations in the current version.

### 10.1 Proxy Demand and Supply Signals

The current demand-side and supply-side datasets are transformed proxies rather than direct peer-to-peer transaction records.

### 10.2 Weather Coverage

The system currently uses Melbourne, VIC as a representative weather point.  
A more production-ready system would use multi-location or regionally aggregated weather features across Victoria.

### 10.3 No Direct Transaction Labels

The system recommends prices based on modeled demand and supply conditions, but does not yet evaluate against a large set of true transaction-level clearing outcomes.

### 10.4 No Postcode or Neighbor Eligibility Data

The current raw datasets do not contain postcode-level, address-level, meter-level, or feeder-level geographic identifiers.

This means the prototype cannot verify whether two participants are true local neighbors within the same eligible shared-energy trading area.

At the moment, the project can model **regional pricing context**, but not full **location-based trading eligibility**.

In a production shared-energy platform, postcode or meter-based validation would likely be required before a pricing recommendation could be turned into a real local transaction.

### 10.5 Prototype Scope

The current platform should be interpreted as a **pricing decision-support prototype**, not a production trading engine.

## 12. Future Improvements

The next steps for the project would be:

- improve regional weather representation
- validate the model with more realistic transaction-level data
- add postcode-level or meter-level location validation for neighbor eligibility
- compare additional ML models such as XGBoost
- add feature importance analysis
- extend the system from historical replay to short-term forward forecasting

## 13. Suggested Final Conclusion

This project demonstrates how applied machine learning can be used to support household solar pricing decisions.  
By combining historical demand, solar supply, and weather data, the system moves beyond rule-based pricing and produces a more context-aware listing recommendation.  
Although the current system is still a prototype, it shows how machine learning can transform complex energy market signals into a practical decision-support tool.

---

## What You Should Add Next

To turn this draft into your final assignment, the most important things to add are:

### A. Real Metric Values

Already filled into the current draft.  
If you rerun the notebook and the values change, replace the table in Section 8.

### B. A Model Comparison Table

Already added in Section 8.

### C. One Figure for Data

Choose one:

- hourly demand over time
- hourly solar supply over time
- weather-aligned replay example

### D. One Figure for Results

Choose one:

- predicted vs actual demand
- feature importance
- dashboard recommendation example

### E. One Short Reflection

Write 4 to 6 sentences on:

- what worked well
- what data assumptions were weakest
- what you would improve if given more time

---

## Recommended Report Structure

If your assignment needs a formal report, use this order:

1. Introduction
2. Problem Statement
3. Data Description
4. Preprocessing and Feature Engineering
5. Models and Methodology
6. Evaluation
7. Results
8. Dashboard / Application
9. Limitations
10. Conclusion

---

## 中文对照版

这一部分只是给你自己对照阅读用，之后你可以删掉，不影响英文正式版。

### 1. 项目概述

这个项目研究的是：机器学习能不能帮助家庭太阳能用户，在进入点对点电力交易市场之前，决定一个更合理的挂牌价格。

项目把三类信息结合在一起：

- VIC1 历史需求侧数据
- 小时级 solar supply 数据
- 按小时对齐的历史天气数据

最终目标不只是预测 demand，而是把预测结果变成一个**可执行的价格建议**。

### 2. 问题定义

这个项目要回答的问题是：

**给定某个未来挂牌小时、家庭预计的 surplus electricity、近期市场历史和天气条件，什么挂牌价最可能带来更好的预期收益？**

这属于 applied machine learning，因为价格、需求、供给、天气和时间之间的关系比较复杂，不适合只靠人工规则硬写。

### 3. 数据集

#### 3.1 VIC1 Demand Data

第一份数据是 VIC1 的 price-demand 数据。  
它被聚合成小时级数据，并进一步转成 buyer-side demand bid proxy。

主要字段包括：

- 小时级时间戳
- total demand
- willingness-to-pay proxy

当前处理后的数据在：

- [`src/data/vic1DemandBids.ts`](/Users/sherly/Downloads/dashboard/src/data/vic1DemandBids.ts:1)
- 原始 CSV 在 [`src/data/price_and_demand_vic1.csv`](/Users/sherly/Downloads/dashboard/src/data/price_and_demand_vic1.csv:1)

#### 3.2 Solar Supply Data

第二份数据是历史 solar generation 数据，后来被聚合成小时级 supply-side surplus signal。

处理逻辑大致是：

- 先把 15 分钟级正的 solar generation 聚合到 site-hour
- 再把多个 site 的结果转成 hour-level 供给参考
- 然后缩放成一个 household-scale surplus proxy

当前处理后的数据在：

- [`src/data/solarSupplyReports.ts`](/Users/sherly/Downloads/dashboard/src/data/solarSupplyReports.ts:1)
- 原始 CSV 在 [`src/data/Solar_Energy_Generation.csv`](/Users/sherly/Downloads/dashboard/src/data/Solar_Energy_Generation.csv:1)

#### 3.3 Historical Weather Data

第三份数据来自 Open-Meteo 的历史天气 API，并按小时和 demand / supply 的时间戳对齐。

之所以要加天气，是因为天气会：

- 直接影响 solar generation
- 间接影响 electricity demand

天气对齐逻辑在：

- [`src/services/weatherService.ts`](/Users/sherly/Downloads/dashboard/src/services/weatherService.ts:1)

### 4. 机器学习目标

这个项目更适合描述成一个两阶段系统：

#### 第一阶段：Demand Modeling

估计在某个市场情境和候选价格下，buyer-side demand 会是多少。

#### 第二阶段：Price Optimization

把 demand prediction 和 supply context 结合起来，对多个候选价格做比较，选出 expected return 最好的挂牌价。

所以它不是单纯 prediction task，而是：

**prediction + optimization**

### 5. 特征工程

当前项目使用了三类特征。

#### 5.1 时间特征

- hour of day
- month
- day of week
- weekend indicator
- sine / cosine 周期特征

#### 5.2 滞后特征

- lag demand at 1 hour
- lag demand at 24 hours
- lag price at 1 hour
- lag price at 24 hours
- rolling 24-hour demand mean
- rolling 24-hour price mean

#### 5.3 天气特征

- temperature
- cloud cover
- precipitation
- shortwave radiation
- direct normal irradiance
- day / night indicator

这些特征的实现主要在：

- [`src/services/aiService.ts`](/Users/sherly/Downloads/dashboard/src/services/aiService.ts:1)

### 6. 模型

#### 6.1 OLS baseline

OLS 作为 baseline model，用来提供一个可解释的线性基准。

#### 6.2 Random Forest

Random Forest 作为更灵活的非线性模型，用来捕捉时间、价格、需求历史和天气之间更复杂的关系。

#### 6.3 Price Search Layer

在 demand 预测之后，系统会对多个 candidate prices 做 grid search，并选择 expected net revenue 最好的那个价格。

### 7. 训练与评估

由于这是时间序列风格的数据，不能随机打乱训练集和测试集。  
所以这里采用的是 **forward-chaining style split**，也就是用更早的数据训练，用更晚的数据验证和测试。

当前切分规模是：

- Training rows: `7,644`
- Validation rows: `1,092`
- Test rows: `2,185`

评估指标包括：

- RMSE
- MAE
- R²

### 8. 当前结果

当前 test set 上的结果是：

| Model | RMSE | MAE | R² |
| --- | --- | --- | --- |
| OLS baseline | 0.3405 | 0.2211 | 0.8990 |
| Random Forest | 0.2892 | 0.1798 | 0.9272 |

#### 8.1 结果解释

Random Forest 在三个指标上都优于 OLS baseline：

- RMSE 从 `0.3405` 降到 `0.2892`
- MAE 从 `0.2211` 降到 `0.1798`
- R² 从 `0.8990` 升到 `0.9272`

这说明 demand、price、time 和 weather 之间的关系并不是完全线性的，Random Forest 能学到更多非线性结构。

### 9. 当前系统输出

系统最后会输出：

- optimized listing price
- expected net revenue
- estimated demand coverage
- expected shortfall
- weather-adjusted explanation

所以它不是一个只给 academic metric 的模型，而是一个 decision-support prototype。

### 10. 为什么这是 AML 项目

这个项目符合 AML 的原因在于，它覆盖了完整的 applied machine learning workflow：

- 现实问题定义
- 多源数据处理
- 特征工程
- baseline 与非线性模型比较
- 时间感知的评估方式
- 最终决策支持输出
- dashboard 展示

### 11. 局限性

目前主要局限包括：

#### 11.1 Demand / Supply 是 proxy

当前的 demand-side 和 supply-side 数据不是完整真实的 P2P transaction records，而是经过转换的 proxy signal。

#### 11.2 Weather coverage 有限

当前系统主要使用 Melbourne, VIC 作为代表天气点。  
如果要更像 production，需要做更区域化的 weather aggregation。

#### 11.3 没有大规模 transaction-level clearing labels

目前的推荐价格是基于 demand / supply / weather 建模出来的，不是拿真实大量成交价格直接监督训练出来的。

#### 11.4 没有 postcode / neighbor eligibility 信息

当前原始数据里没有 postcode、address、meter-level identifier 或 feeder-level 地理信息。

这意味着系统现在还不能验证两个参与者是否真的是同一个 shared-energy 邻里网络中的合格邻居。

也就是说，当前项目可以做的是 **区域级 pricing recommendation**，但还不能完成 **地理邻里资格验证**。

如果是一个真实上线的 shared-energy 平台，通常还需要补充 postcode 或 meter-based validation。

#### 11.5 仍然是 prototype

当前系统更适合被定义为 **pricing decision-support prototype**，而不是 production trading engine。

### 12. 未来改进

之后可以继续做的方向包括：

- 更好的区域天气覆盖
- 更多真实 transaction-level data
- 增加 postcode-level 或 meter-level neighbor eligibility validation
- 比较更多模型，比如 XGBoost
- 做 feature importance analysis
- 从历史回放扩展到短期前瞻预测

### 13. 结论

这个项目展示了 applied machine learning 如何帮助 household solar pricing decision。  
通过结合 historical demand、solar supply 和 weather data，系统不再只靠经验规则，而是能给出更 context-aware 的挂牌建议。  
虽然当前版本仍然是 prototype，但它已经展示了机器学习如何把复杂的电力市场信号转成实际可用的决策支持工具。
