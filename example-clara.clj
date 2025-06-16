(ns example-clara
  (:require [clara.rules :as r]
            [clara.rules.accumulators :as acc]
            [clojure.string :as string]
            [clara-eav.rules :as er]
            [clara-eav.eav :as eav]
            [clojure.set :as set]))

(er/defrule generate-similar-rhs-objects
  "Identify if a tuple has a similar matching object opposite side"
  [[?rhsRootLevelEid :rhs/parentLinkingAttributeName "rhs"]]
  [[?rhsRootLevelEid :rhs/childEids ?rhsChildEids]]
  [[?lhsRootLevelEid :lhs/parentLinkingAttributeName "lhs"]]
  [[?lhsRootLevelEid :lhs/childEids ?lhsChildEids]]
  [:eav/all
   (= (:e this) ?someRhsEid)
   (= (:a this) ?someRhsAttribute)
   (= (:v this) ?someRhsValue)
   (string/ends-with? ?someRhsAttribute "parentLinkingAttributeName")
   (contains? ?rhsChildEids ?someRhsEid)]
  [:eav/all
   (= (:e this) ?someLhsEid)
   (= (:a this) ?someRhsAttribute)
   (= (:v this) ?someRhsValue)
   (contains? ?lhsChildEids ?someLhsEid)]
  =>
  (er/upsert-unconditional! {:eav/eid "NewObject"
                             :objectMatch/rhsEid ?someRhsEid
                             :objectMatch/lhsEid ?someLhsEid
                             :objectMatch/parentLinkingAttributeName ?someRhsValue}))

(er/defrule generate-missing-rhs-objects
  "Starting on the light-hand side, identify when there are no matching rhs objects"
  [[?rhsRootLevelEid :rhs/parentLinkingAttributeName "rhs"]]
  [[?rhsRootLevelEid :rhs/childEids ?rhsChildEids]]  
  [[?lhsRootLevelEid :lhs/parentLinkingAttributeName "lhs"]]
  [[?lhsRootLevelEid :lhs/childEids ?lhsChildEids]]
  [:eav/all
   (= (:e this) ?someLhsEid)
   (= (:a this) ?someLhsAttribute)
   (= (:v this) ?someLhsValue)
   (string/ends-with? ?someLhsAttribute "parentLinkingAttributeName")
   (contains? ?lhsChildEids ?someLhsEid)]
  [:not
   [:and [:eav/all
          (= (:a this) ?someLhsAttribute)
          (= (:v this) ?someLhsValue)
          (contains? ?rhsChildEids (:e this))]]]
  =>
  (er/upsert-unconditional! ["MissingRhsObject" :rhsMissing/lhsEid ?someLhsEid]))

;; This rule demonstrates how the same variables should be highlighted 
;; with the same colors within this form scope
(er/defrule count-number-of-similar-objects
  "Count the number of distinct and matching budget types"
  [[?objectMatchEid :objectMatch/rhsEid ?someRhsEid]]
  [[?objectMatchEid :objectMatch/lhsEid ?someLhsEid]]
  [?rhsMatchingCount <- (acc/count) :from [[_ :objectMatch/rhsEid ?someRhsEid]]]
  [?lhsMatchingCount <- (acc/count) :from [[_ :objectMatch/lhsEid ?someLhsEid]]]
  =>
  (er/upsert! [[?objectMatchEid :objectMatch/rhsMatchingEidCounts ?rhsMatchingCount]
               [?objectMatchEid :objectMatch/lhsMatchingEidCounts ?lhsMatchingCount]]))
