# Armenian realtime evaluation set

Use before cold outreach. Score `gpt-realtime-2.1` vs `gpt-realtime-2.1-mini` 1–5 on comprehension, factual capture, natural Armenian, latency, interruption, and code-switching.

## Short utterances (30–50)

Speak each once on a laptop mic, then once with background noise.

1. Օրական մոտ 80 պատվեր ենք ստանում։
2. Երբեմն 50 է, երբեմն 100։
3. Մեկ պատվերի վրա աշխատակիցը մոտ 6 րոպե է ծախսում։
4. Սա ամսական մոտ 1500 գործողություն է։
5. Վճարումները դրամով են, երբեմն USD։
6. Գումարը մոտ 2 միլիոն դրամ է ամսական։
7. Մենք աշխատում ենք 1C-ով։
8. 1C-ն հարմարեցված է, import-ը հեշտ չէ։
9. Excel-ում պահում ենք պահեստի մնացորդը։
10. Invoice-ները գալիս են PDF-ով էլփոստին։
11. Order intake-ը WhatsApp-ով է գալիս։
12. SKU-ները հաճախ սխալ են գրվում։
13. MegaFood-ի հետ աշխատում ենք 2019-ից։
14. Ararat Logistics-ը երեք պահեստ ունի։
15. ArmSoft-ը հաշվապահության համար է։
16. ERP-ն կա, բայց CRM չկա։
17. Եթե volume-ը 50%-ով աճի, warehouse-ում մարդ կպետք գա։
18. Reconciliation-ը ամեն շաբաթ է արվում։
19. Three-way match չենք անում։
20. Ապրանքագիրը գալիս է, հետո ձեռքով մուտք ենք անում 1C։
21. Оплаты иногда задерживаются на неделю.
22. Мы это делаем каждый день, потом Excel.
23. Invoice processing is the painful part.
24. Can you hear me? Մի րոպե սպասեք։
25. Ոչ, ոչ 8-ը, 80-ն եմ ասում։
26. Ես չգիտեմ ճշգրիտ թիվը, մոտավորապես 10-ի կարգի։
27. Սա արդեն ավտոմատացված է, բացառություններն են մնում։
28. Գաղտնաբառ չեմ տա, միայն օրինակներ։
29. Կարող ենք anonymized historical samples տալ։
30. Pilot-ի համար IT-ն ու 1C մասնագետը պետք են։
31. Սխալների պատճառով առաքումը ուշանում է։
32. Cash-flow-ի վրա ազդում է, որովհետև invoice-ները կորում են։
33. Երկու հաշվապահ է սրա վրա նստած։
34. Սա ստեղծագործ աշխատանք չէ, կրկնվող է։
35. Paper-ով էլ կան փաստաթղթեր, հիմնականում PDF։
36. Telegram խմբում են վարորդները գրում։
37. Seasonality կա՝ դեկտեմբերին կրկնապատկվում է։
38. Peak-ը առավոտյան 10-ից 12-ն է։
39. Waiting time-ը երկու օր է, active work-ը 5 րոպե։
40. Նախկինում փորձել ենք ավտոմատացնել, failed because no API.
41. Ի՞նչ գիտեք մեր մասին։
42. Ես CEO եմ, operations-ի թվերը ճշգրիտ չգիտեմ։
43. Կարճ պատասխանեմ՝ շատ ժամանակ է խլում։
44. Ժամանակ չունեմ, 5 րոպե։
45. Կրկնում եմ՝ օրական ոչ թե 18, այլ 80։
46. Customer support-ը նույն Excel-ն է օգտագործում։
47. Procurement-ը էլփոստով է գնումներ անում։
48. HR/admin-ը փոքր է, սա operations է։
49. [long pause 8 seconds] Հա, լսում եմ։
50. [60–120 second answer] պատմել order-ից մինչև 1C մուտք՝ քայլ առ քայլ։

## Five mock interviews

1. High-volume FMCG distributor, 2,000 orders/month, Excel + 1C.
2. Already-automated distributor; remaining work is exceptions.
3. Tiny company, no material volume.
4. CFO focused on AP invoices, mixed Armenian/Russian.
5. Impatient CEO who asks what we already know.

Record prompt_version, model, and scores in `src/eval/scorecard.md`.
