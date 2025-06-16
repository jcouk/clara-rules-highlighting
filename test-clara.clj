(ns test-clara
  (:require [clara.rules :as r]))

;; Test file for Clara Rules variable highlighting
;; Variables starting with ? should be highlighted with consistent colors

(r/defrule sample-rule
  "A sample rule to test variable highlighting"
  [?person [:person/name ?name]]
  [?person [:person/age ?age]]
  [?company [:company/name ?companyName]]
  [?person [:person/employer ?company]]
  [:test (> ?age 18)]
  =>
  (println "Found adult employee:" ?name "working at" ?companyName)
  (r/insert! {:type :adult-employee
              :name ?name
              :age ?age
              :company ?companyName}))

(r/defrule another-rule
  "Another rule with different variables"
  [?order [:order/id ?orderId]]
  [?order [:order/customer ?customer]]
  [?customer [:customer/status :vip]]
  [?product [:product/id ?productId]]
  [?order [:order/items ?items]]
  [:test (some #(= (:product-id %) ?productId) ?items)]
  =>
  (println "VIP customer" ?customer "ordered product" ?productId))

;; Same variables should have same color within the same rule scope
;; but different colors across different rule scopes
