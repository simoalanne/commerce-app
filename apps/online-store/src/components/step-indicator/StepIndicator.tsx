"use client";

import styles from "./StepIndicator.module.css";

type Step = {
  id: string;
  label?: string;
};

type StepIndicatorProps = {
  steps: Step[];
  currentStep: number;
  showLabels?: boolean;
};

export default function StepIndicator({
  steps,
  currentStep,
  showLabels = true,
}: StepIndicatorProps) {
  return (
    <div className={styles.steps}>
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isPast = index < currentStep;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className={styles.step}>
            <div
              className={[styles.circle, (isActive || isPast) && styles.circleProgress]
                .filter(Boolean)
                .join(" ")}
            >
              {index + 1}
            </div>

            {showLabels && (
              <div
                className={[styles.label, (isActive || isPast) && styles.labelProgress]
                  .filter(Boolean)
                  .join(" ")}
              >
                {step.label}
              </div>
            )}

            {!isLast && (
              <div
                className={[styles.divider, isPast && styles.dividerProgress]
                  .filter(Boolean)
                  .join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
