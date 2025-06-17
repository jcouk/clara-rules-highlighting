(ns compare.rules.clara-diff-rules
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

;; I don't think a rule like this is necessary.
;; I can't think of a scenario where the side we start with matters
;; #_{:clj-kondo/ignore [:unresolved-symbol]}
;; (er/defrule identify-similar-lhs-objects
;;   "Identify if a tuple has a similar matching object opposite side"
;;   [[?lhsRootLevelEid :lhs/parentLinkingAttributeName "lhs"]]
;;   [[?lhsRootLevelEid :lhs/childEids ?lhsChildEids]]
;;   [[?rhsRootLevelEid :rhs/parentLinkingAttributeName "rhs"]]
;;   [[?rhsRootLevelEid :rhs/childEids ?rhsChildEids]]
;;   [:eav/all
;;    (= (:e this) ?someLhsEid)
;;    (= (:a this) ?someLhsAttribute)
;;    (= (:v this) ?someLhsValue)
;;    (string/ends-with? ?someLhsAttribute "parentLinkingAttributeName")
;;    (contains? ?lhsChildEids ?someLhsEid)]
;;   [:eav/all
;;    (= (:e this) ?someRhsEid)
;;    (= (:a this) ?someLhsAttribute)
;;    (= (:v this) ?someLhsValue)
;;    (contains? ?rhsChildEids ?someRhsEid)]
;;   [:not [:and
;;          [[?someobjectMatch :objectMatch/rhsEid ?someRhsEid]]
;;          [[?someobjectMatch :objectMatch/lhsEid ?someLhsEid]]]]
;;   =>
;;   (er/upsert! [["NewObject" :lhsMatch/rhsEid ?someRhsEid]
;;                ["NewObject" :lhsMatch/lhsEid ?someLhsEid]]))


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


(er/defrule generate-missing-lhs-objects
  "Starting on the light-hand side, identify when there are no matching rhs objects"
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
  [:not
   [:and [:eav/all ;; :and not necessary - but not a problem
          (= (:a this) ?someRhsAttribute)
          (= (:v this) ?someRhsValue)
          (contains? ?lhsChildEids (:e this))]]]
  =>
  (er/upsert-unconditional! ["MissingLhsObject" :lhsMissing/rhsEid ?someRhsEid]))



;; for matched objects, count the number of similar such objects on each side and see if they're equal or not
(er/defrule count-number-of-similar-objects
  "Count the number of distinct and matching budget types to see if there are less or more"
  [[?objectMatchEid :objectMatch/rhsEid ?someRhsEid]]
  [[?objectMatchEid :objectMatch/lhsEid ?someLhsEid]]
  [?rhsMatchingCount <- (acc/count) :from [[_ :objectMatch/rhsEid ?someRhsEid]]]
  [?lhsMatchingCount <- (acc/count) :from [[_ :objectMatch/lhsEid ?someLhsEid]]]
  =>
  (er/upsert! [[?objectMatchEid :objectMatch/rhsMatchingEidCounts ?rhsMatchingCount]
               [?objectMatchEid :objectMatch/lhsMatchingEidCounts ?lhsMatchingCount]]))


(er/defrule identify-count-mismatches
  "Identify when the matching Eid counts are not the same.  This indicates that an object has been added or removed"
  [[?objectMatchEid :objectMatch/rhsMatchingEidCounts ?rhsMatchingCount]]
  [:eav/all
   (= (:e this) ?objectMatchEid)
   (= (:a this) :objectMatch/lhsMatchingEidCounts)
   (= (:v this) ?lhsMatchingCount)]
  =>
  (let [lhsAndRhsMatching (not (= ?rhsMatchingCount ?lhsMatchingCount))]
    (er/upsert! [?objectMatchEid :objectMatch/objectMisMatchIdentified lhsAndRhsMatching])))

(er/defrule identify-parent-has-same-missmatch
  "For each object Match that has a objectMisMatchIdentified check to see if it's parent has the same mismatch"
  [[?objectMatchEid :objectMatch/objectMisMatchIdentified ?objectMismatchValue]]
  [[?objectMatchEid :objectMatch/lhsEid ?matchLhsEid]]
  [:eav/all
   (= (:e this) ?matchLhsEid)
   (= (:a this) ?someLhsAttribute)
   (= (:v this) ?lhsParentEid)
   (string/ends-with? ?someLhsAttribute "parentEid")]
  [[?otherObjectMatchEid :objectMatch/lhsEid ?lhsParentEid]]
  [[?otherObjectMatchEid :objectMatch/objectMisMatchIdentified ?objectMismatchValue]]
  =>
  (println "Identified a parent has the same mismatch" ?objectMatchEid "and" ?otherObjectMatchEid)
  (let [childHasSameMisMatch (= ?objectMismatchValue true)]
    (er/upsert-unconditional! [?objectMatchEid :objectMatch/parentHasSameMismatch childHasSameMisMatch])))

(er/defrule identify-lhs-attribute-value-mismatch
  "Work through every attribute on the right side and identify when there isn't the same attribute on the left side"
  {:salience -1}
  [[?objectMatchEid :objectMatch/rhsEid ?someRhsEid]]
  [[?objectMatchEid :objectMatch/lhsEid ?someLhsEid]]
  ;; [:not [[?objectMatchEid :objectMatch/parentHasSameMismatch true]]]  ;; If there's a parent mismatch we might want to find some other mechanism to identify the mismatch
  ;; [:not [:objectMatch/parentHasSameMismatch (= (:e this) ?objectMatchEid) (= (:v this) false)]]
  [:not [:objectMatch/parentHasSameMismatch (= (:e this) ?objectMatchEid) (= (:v this) true)]]
  [[?someRhsEid ?someRhsAttribute ?someRhsAttributeValue]]  ;; identify each attribute
  [:not
   [:eav/all
    (= (:e this) ?someLhsEid)
    (= (:a this) ?someRhsAttribute)]] ;; There is NOT the same attribute on the left side
  =>
  (println "Identified a missing LHS attribute" ?objectMatchEid "and" ?someRhsAttribute)
  (er/upsert! [[?objectMatchEid :objectMatch/missingLhsAttributeValue ?someRhsAttributeValue]
               [?objectMatchEid :objectMatch/missingLhsAttribute ?someRhsAttribute]]))

;; Testing to see if writing the rule with the default clara /r/ syntax solves my truth maintenance issue.  It does not
;; #_{:clj-kondo/ignore [:unresolved-symbol]}
;; (r/defrule identify-lhs-attribute-value-mismatch
;;   "Work through every attribute on the right side and identify when there isn't the same attribute on the left side"
;;   [:eav/all
;;    (= (:e this) ?objectMatchEid)
;;    (= (:a this) :objectMatch/rhsEid)
;;    (= (:v this) ?someRhsEid)]
;;   [:eav/all
;;    (= (:e this) ?objectMatchEid)
;;    (= (:a this) :objectMatch/lhsEid)
;;    (= (:v this) ?someLhsEid)]
;;   ;; If there's a parent mismatch we might want to find some other mechanism to identify the mismatch
;;   [:not [:eav/all
;;    (= (:e this) ?objectMatchEid)
;;    (= (:a this) :objectMatch/parentHasSameMismatch)
;;    (= (:v this) true)]]
;;   ;; identify each attribute
;;   [:eav/all
;;    (= (:e this) ?someRhsEid)
;;    (= (:a this) ?someRhsAttribute)
;;    (= (:v this) ?someRhsAttributeValue)]
;;   [:not
;;    [:eav/all
;;     (= (:e this) ?someLhsEid)
;;     (= (:a this) ?someRhsAttribute)]] ;; There is NOT the same attribute on the left side
;;   =>
;;   (println "Identified a missing LHS attribute" ?objectMatchEid "and" ?someRhsAttribute)
;;   (er/upsert! [[?objectMatchEid :objectMatch/missingLhsAttributeValue ?someRhsAttributeValue]
;;                [?objectMatchEid :objectMatch/missingLhsAttribute ?someRhsAttribute]]))


(er/defrule identify-rhs-attribute-value-mismatch
  "Work through every attribute on the right side and identify when there isn't the same attribute on the left side"
  [[?objectMatchEid :objectMatch/lhsEid ?someLhsEid]]
  [[?objectMatchEid :objectMatch/rhsEid ?someRhsEid]]
  [[?objectMatchEid :objectMatch/parentHasSameMismatch false]]
  ;;   [:or [:not [[?objectMatchEid :objectMatch/parentHasSameMismatch]]]
  ;;    [[?objectMatchEid :objectMatch/parentHasSameMismatch false]]]
  ;;   [:not [[?objectMatchEid :objectMatch/parentHasSameMismatch]]] ;; Exclude those that have hte same parent mismatch for now because this is probably invalid
  [[?someLhsEid ?someLhsAttribute ?someLhsValue]]  ;; identify each attribute
  [:not
   [:eav/all
    (= (:e this) ?someRhsEid)
    (= (:a this) ?someLhsAttribute)]] ;; There is NOT the same attribute on the left side
  =>
  (println "Identified a missing RHS attribute" ?objectMatchEid "and" ?someLhsAttribute)
  (er/upsert! [[?objectMatchEid :objectMatch/missingRhsAttributeValue ?someLhsAttribute]
               [?objectMatchEid :objectMatch/missingRhsAttribute ?someLhsAttribute]]))


(comment

  (contains? #{7 4 13 6 3 12 11 9 5 10 8} 7)
  (println "Checking if 2 is in the list: " (contains? [5 2 1] 2))

  (.endsWith (str :nested_example/parentEid) "parentEid")
  :rcf)