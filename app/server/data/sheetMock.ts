export const sheetMock = {
  plans: [
    { plan_id: 'jn_ultimate_ppl_4x', plan_name: 'Jeff Nippard Ultimate PPL 4x', active: true }
  ],
  phases: [
    { phase_id: 'p1_base_hyp', plan_id: 'jn_ultimate_ppl_4x', phase_name: 'Base Hypertrophy', phase_order: 1, weeks_count: 8 }
  ],
  workouts: [
    { workout_id: 'p1w1_legs1', phase_id: 'p1_base_hyp', week_number: 1, day_name: 'Legs #1', workout_order: 1, focus: 'Legs' },
    { workout_id: 'p1w1_push1', phase_id: 'p1_base_hyp', week_number: 1, day_name: 'Push #1', workout_order: 2, focus: 'Push' }
  ],
  exercises: [
    { exercise_id: 'p1w1_legs1_e1', workout_id: 'p1w1_legs1', order: 1, name: 'Squat', warmup_sets: '3-4', working_sets: '1', reps: '2-4', load: '', rpe: '8-9', rest: '~3-4 min', sub1: 'Hack Squat', sub2: 'DB Bulgarian Split Squat', notes: 'Sit back and down, keep your upper back tight to the bar', group: '' },
    { exercise_id: 'p1w1_legs1_e2', workout_id: 'p1w1_legs1', order: 2, name: 'Pause Squat (Back off)', warmup_sets: '0', working_sets: '2', reps: '5', load: '', rpe: '8-9', rest: '~3-4 min', sub1: 'Pause Hack Squat', sub2: 'Pause DB Bulgarian Split Squat', notes: 'Drop the weight by ~25% from your top set. 2 second pause.', group: '' },
    { exercise_id: 'p1w1_legs1_e3', workout_id: 'p1w1_legs1', order: 3, name: 'Barbell RDL', warmup_sets: '2', working_sets: '3', reps: '8-10', load: '', rpe: '8-9', rest: '~2-3 min', sub1: 'DB RDL', sub2: '45° Hyperextension', notes: 'Maintain a neutral lower back, set your hips back, do not allow your spine to round', group: '' },
    { exercise_id: 'p1w1_legs1_e4', workout_id: 'p1w1_legs1', order: 4, name: 'Walking Lunge', warmup_sets: '1', working_sets: '2', reps: '10', load: '', rpe: '8-9', rest: '~2-3 min', sub1: 'DB Step-Up', sub2: 'Goblet Squat', notes: 'Take medium strides, minimize the amount you push off your rear leg', group: '' },
    { exercise_id: 'p1w1_legs1_e5', workout_id: 'p1w1_legs1', order: 5, name: 'Seated Leg Curl', warmup_sets: '1', working_sets: '3', reps: '10-12', load: '', rpe: '9-10', rest: '~1-2 min', sub1: 'Lying Leg Curl', sub2: 'Nordic Ham Curl', notes: 'Focus on squeezing your hamstrings to move the weight', group: '' },
    { exercise_id: 'p1w1_legs1_e6', workout_id: 'p1w1_legs1', order: 6, name: 'Leg Press Toe Press', warmup_sets: '1', working_sets: '4', reps: '10-12', load: '', rpe: '9-10', rest: '~1-2 min', sub1: 'Seated Calf Raise', sub2: 'Standing Calf Raise', notes: 'Press all the way up to your toes, stretch your calves at the bottom, do not bounce', group: '' },
    { exercise_id: 'p1w1_legs1_e7', workout_id: 'p1w1_legs1', order: 7, name: 'Decline Plate-Weighted Crunch', warmup_sets: '1', working_sets: '3', reps: '10-12', load: '', rpe: '9-10', rest: '~1-2 min', sub1: 'Cable Crunch', sub2: 'Machine Crunch', notes: 'Hold a plate or DB to your chest and crunch hard', group: '' },

    { exercise_id: 'p1w1_push1_e1', workout_id: 'p1w1_push1', order: 1, name: 'Bench Press', warmup_sets: '3-4', working_sets: '1', reps: '3-5', load: '', rpe: '8-9', rest: '~3-4 min', sub1: 'DB Bench Press', sub2: 'Machine Chest Press', notes: 'Set up a comfortable arch, quick pause on the chest and explode up on each rep', group: '' },
    { exercise_id: 'p1w1_push1_e2', workout_id: 'p1w1_push1', order: 2, name: 'Larsen Press', warmup_sets: '0', working_sets: '2', reps: '10', load: '', rpe: '8-9', rest: '~3-4 min', sub1: 'DB Bench Press (No Leg Drive)', sub2: 'Machine Chest Press (No Leg Drive)', notes: 'Shoulder blades still retracted and depressed. Slight arch in upper back. Zero leg drive.', group: '' },
    { exercise_id: 'p1w1_push1_e3', workout_id: 'p1w1_push1', order: 3, name: 'Standing Dumbbell Arnold Press', warmup_sets: '2', working_sets: '3', reps: '8-10', load: '', rpe: '8-9', rest: '~2-3 min', sub1: 'Seated DB Shoulder Press', sub2: 'Machine Shoulder Press', notes: 'Start with elbows in front and palms in; rotate so palms face forward as you press', group: '' },
    { exercise_id: 'p1w1_push1_e4', workout_id: 'p1w1_push1', order: 4, name: 'Press-Around', warmup_sets: '1', working_sets: '2', reps: '12-15', load: '', rpe: '9-10', rest: '0 min', sub1: 'DB Flye', sub2: 'Deficit Push Up', notes: 'Brace with your non-working arm, squeeze your pecs by pressing the cable across your body', group: 'A' },
    { exercise_id: 'p1w1_push1_e5', workout_id: 'p1w1_push1', order: 5, name: 'Pec Static Stretch 30s', warmup_sets: '0', working_sets: '2', reps: '30s HOLD', load: '', rpe: 'N/A', rest: '0 min', sub1: 'N/A', sub2: 'N/A', notes: 'Hold a pec stretch for 30 seconds at about 7/10 intensity', group: 'A' },
    { exercise_id: 'p1w1_push1_e6', workout_id: 'p1w1_push1', order: 6, name: 'Cross-Body Cable Y-Raise (Side Delt)', warmup_sets: '1', working_sets: '3', reps: '12-15', load: '', rpe: '9-10', rest: '~1-2 min', sub1: 'DB Lateral Raise', sub2: 'Machine Lateral Raise', notes: 'Think about swinging the cable out and up as if drawing a sword', group: '' },
    { exercise_id: 'p1w1_push1_e7', workout_id: 'p1w1_push1', order: 7, name: 'Squeeze-Only Triceps Pressdown + Stretch-Only Overhead Extension', warmup_sets: '1', working_sets: '3', reps: '8 + 8', load: '', rpe: '9-10', rest: '~1-2 min', sub1: 'Triceps Pressdown (12-15 reps)', sub2: 'DB Skull Crusher (12-15 reps)', notes: 'Do the second half of the ROM for pressdowns and the first half for overhead extensions', group: '' },
    { exercise_id: 'p1w1_push1_e8', workout_id: 'p1w1_push1', order: 8, name: 'N1-Style Cross-Body Triceps Extension', warmup_sets: '0', working_sets: '2', reps: '10-12', load: '', rpe: '10', rest: '~1-2 min', sub1: 'Single-Arm Tricep Pressdown', sub2: 'Single-Arm Cable Tricep Kickback', notes: 'Extend your triceps with your arm more out to the side than a regular pressdown', group: '' }
  ]
}
